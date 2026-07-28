import { Router } from 'express';
import { query } from '../db.js';
import { requireAdmin } from '../auth.js';
import { productImageUpload } from '../lib/uploads.js';
import { sendNewsletterBroadcast, sendQuoteToClient, quoteLink } from '../lib/email.js';
import {
  calConfigured,
  calManageLinks,
  getCalCalendarSummary,
  listCalBookings,
  listCalEventTypes,
} from '../lib/calStore.js';
import { assertEarlyBirdQuoteSlot, EARLYBIRD_CODE } from '../lib/stripe.js';
import contentEngineRoutes from './content-engine.js';
import {
  listThreadsAdmin,
  getThreadById,
  listAllMessages,
  claimThread,
  releaseToMiranda,
  closeThread,
  insertMessage,
  countAwaitingThreads,
} from '../lib/mirandaChat.js';

const router = Router();
router.use(requireAdmin);
router.use('/content-engine', contentEngineRoutes);

router.post('/uploads/product-image', (req, res) => {
  productImageUpload.single('image')(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message || 'Upload failed' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided' });
      return;
    }
    res.status(201).json({ url: `/uploads/products/${req.file.filename}` });
  });
});

function slugify(text) {
  return String(text).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

router.get('/stats', async (_req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        (SELECT count(*)::int FROM products WHERE active) AS products,
        (SELECT count(*)::int FROM portfolio_projects WHERE active) AS portfolio,
        (SELECT count(*)::int FROM support_tickets WHERE status = 'open') AS open_tickets,
        (SELECT count(*)::int FROM inquiry_submissions WHERE status = 'new') AS new_inquiries,
        (SELECT count(*)::int FROM bookings WHERE status = 'confirmed' AND starts_at >= now()) AS upcoming_bookings,
        (SELECT count(*)::int FROM newsletter_subscribers) AS subscribers,
        (SELECT CASE WHEN to_regclass('public.seo_pages') IS NULL THEN 0
          ELSE (SELECT count(*)::int FROM seo_pages WHERE status = 'published') END) AS seo_pages
    `);
    res.json(rows[0]);
  } catch (err) {
    console.error('admin stats:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

/* ---------- Products ---------- */
router.get('/products', async (_req, res) => {
  const { rows } = await query(
    `SELECT id, slug, name, category_slug, price_cents, description, color, images, variants,
            active, sort_order, stock_quantity, track_inventory, sku
     FROM products ORDER BY sort_order, id`,
  );
  res.json({ products: rows });
});

router.post('/products', async (req, res) => {
  const b = req.body;
  const slug = b.slug || slugify(b.name);
  const { rows } = await query(
    `INSERT INTO products (slug, name, category_slug, price_cents, description, color, images, variants,
      active, sort_order, stock_quantity, track_inventory, sku)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13) RETURNING *`,
    [slug, b.name, b.category_slug || b.cat || 'apparel', b.price_cents ?? (b.price * 100), b.description || '',
      b.color || 'from-indigo-500 to-violet-700', JSON.stringify(b.images || []), JSON.stringify(b.variants || {}),
      b.active !== false, b.sort_order ?? 0, Math.max(0, Number(b.stock_quantity) || 0),
      !!b.track_inventory, b.sku || null],
  );
  res.status(201).json({ product: rows[0] });
});

router.put('/products/:id', async (req, res) => {
  const b = req.body;
  const { rows } = await query(
    `UPDATE products SET slug=$1, name=$2, category_slug=$3, price_cents=$4, description=$5, color=$6,
      images=$7::jsonb, variants=$8::jsonb, active=$9, sort_order=$10, stock_quantity=$11, track_inventory=$12, sku=$13
     WHERE id=$14 RETURNING *`,
    [b.slug, b.name, b.category_slug, b.price_cents, b.description, b.color,
      JSON.stringify(b.images || []), JSON.stringify(b.variants || {}), b.active !== false, b.sort_order ?? 0,
      Math.max(0, Number(b.stock_quantity) || 0), !!b.track_inventory, b.sku || null, req.params.id],
  );
  if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ product: rows[0] });
});

router.delete('/products/:id', async (req, res) => {
  await query('DELETE FROM products WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

/* ---------- Categories ---------- */
router.get('/categories', async (_req, res) => {
  const { rows } = await query('SELECT * FROM product_categories ORDER BY sort_order, id');
  res.json({ categories: rows });
});

router.post('/categories', async (req, res) => {
  const b = req.body;
  const { rows } = await query(
    `INSERT INTO product_categories (slug, label, icon, sort_order) VALUES ($1,$2,$3,$4) RETURNING *`,
    [b.slug || slugify(b.label), b.label, b.icon || '', b.sort_order ?? 0],
  );
  res.status(201).json({ category: rows[0] });
});

router.put('/categories/:slug', async (req, res) => {
  const b = req.body;
  const { rows } = await query(
    `UPDATE product_categories SET label=$1, icon=$2, sort_order=$3 WHERE slug=$4 RETURNING *`,
    [b.label, b.icon, b.sort_order ?? 0, req.params.slug],
  );
  if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ category: rows[0] });
});

router.delete('/categories/:slug', async (req, res) => {
  await query('DELETE FROM product_categories WHERE slug = $1', [req.params.slug]);
  res.json({ ok: true });
});

/* ---------- Portfolio ---------- */
router.get('/portfolio', async (_req, res) => {
  const { rows } = await query('SELECT * FROM portfolio_projects ORDER BY sort_order, id');
  res.json({ projects: rows });
});

router.post('/portfolio', async (req, res) => {
  const b = req.body;
  const slug = b.slug || slugify(b.name);
  const { rows } = await query(
    `INSERT INTO portfolio_projects (slug, name, tag, color, role, year, stack, summary, highlights, sort_order, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11) RETURNING *`,
    [slug, b.name, b.tag || '', b.color || '', b.role || '', b.year || '', b.stack || '', b.summary || '',
      JSON.stringify(b.highlights || []), b.sort_order ?? 0, b.active !== false],
  );
  res.status(201).json({ project: rows[0] });
});

router.put('/portfolio/:id', async (req, res) => {
  const b = req.body;
  const { rows } = await query(
    `UPDATE portfolio_projects SET slug=$1, name=$2, tag=$3, color=$4, role=$5, year=$6, stack=$7,
      summary=$8, highlights=$9::jsonb, sort_order=$10, active=$11 WHERE id=$12 RETURNING *`,
    [b.slug, b.name, b.tag, b.color, b.role, b.year, b.stack, b.summary,
      JSON.stringify(b.highlights || []), b.sort_order ?? 0, b.active !== false, req.params.id],
  );
  if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ project: rows[0] });
});

router.delete('/portfolio/:id', async (req, res) => {
  await query('DELETE FROM portfolio_projects WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

/* ---------- Users (for app assignment) ---------- */
router.get('/users', async (_req, res) => {
  const { rows } = await query(
    `SELECT id, email, name, role, created_at FROM users ORDER BY email`,
  );
  res.json({ users: rows });
});

/* ---------- Home apps ---------- */
async function syncHomeAppEligibility(homeAppId, userIds) {
  await query('DELETE FROM user_app_eligibility WHERE home_app_id = $1', [homeAppId]);
  if (!userIds?.length) return;
  const ids = [...new Set(userIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  for (const uid of ids) {
    await query(
      'INSERT INTO user_app_eligibility (user_id, home_app_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [uid, homeAppId],
    );
  }
}

router.get('/home-apps', async (_req, res) => {
  const { rows } = await query(
    `SELECT h.*,
      (SELECT count(*)::int FROM user_app_eligibility e WHERE e.home_app_id = h.id) AS assignee_count
     FROM home_apps h
     ORDER BY h.screen, h.sort_order, h.id`,
  );
  res.json({ apps: rows });
});

router.get('/home-apps/:id/assignments', async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.email, u.name, u.role
     FROM user_app_eligibility e
     JOIN users u ON u.id = e.user_id
     WHERE e.home_app_id = $1
     ORDER BY u.email`,
    [req.params.id],
  );
  res.json({ users: rows, user_ids: rows.map((r) => r.id) });
});

router.post('/home-apps', async (req, res) => {
  const b = req.body;
  const assignUsers = !!b.assign_users;
  const { rows } = await query(
    `INSERT INTO home_apps (
       app_id, label, glyph, tile, screen, portfolio_slug, sort_order,
       requires_auth, assign_users, active, launch_type, launch_url, store_visible, auto_install,
       store_description, store_pricing, store_features, store_credits
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
    [
      b.app_id, b.label, b.glyph || '📱', b.tile, b.screen || 'home', b.portfolio_slug || null,
      b.sort_order ?? 0, !!b.requires_auth || assignUsers, assignUsers, b.active !== false,
      b.launch_type || 'embedded', b.launch_url || null,
      b.store_visible !== false, !!b.auto_install,
      b.store_description || null, b.store_pricing || null,
      JSON.stringify(Array.isArray(b.store_features) ? b.store_features : []),
      b.store_credits || null,
    ],
  );
  if (assignUsers && b.user_ids) await syncHomeAppEligibility(rows[0].id, b.user_ids);
  res.status(201).json({ app: rows[0] });
});

router.put('/home-apps/:id', async (req, res) => {
  const b = req.body;
  const assignUsers = !!b.assign_users;
  const { rows } = await query(
    `UPDATE home_apps SET
       app_id=$1, label=$2, glyph=$3, tile=$4, screen=$5, portfolio_slug=$6, sort_order=$7,
       requires_auth=$8, assign_users=$9, active=$10, launch_type=$11, launch_url=$12,
       store_visible=$13, auto_install=$14,
       store_description=$15, store_pricing=$16, store_features=$17, store_credits=$18
     WHERE id=$19 RETURNING *`,
    [
      b.app_id, b.label, b.glyph, b.tile, b.screen, b.portfolio_slug || null, b.sort_order ?? 0,
      !!b.requires_auth || assignUsers, assignUsers, b.active !== false,
      b.launch_type || 'embedded', b.launch_url || null,
      b.store_visible !== false, !!b.auto_install,
      b.store_description || null, b.store_pricing || null,
      JSON.stringify(Array.isArray(b.store_features) ? b.store_features : []),
      b.store_credits || null,
      req.params.id,
    ],
  );
  if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
  if (b.user_ids !== undefined) await syncHomeAppEligibility(rows[0].id, b.user_ids);
  res.json({ app: rows[0] });
});

router.delete('/home-apps/:id', async (req, res) => {
  await query('DELETE FROM home_apps WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

/* ---------- Calendar (Cal.diy live data) ---------- */
router.get('/calendar/summary', async (_req, res) => {
  try {
    if (!calConfigured()) {
      res.json({
        configured: false,
        manage: calManageLinks(),
        error: 'CAL_DATABASE_URL is not set on the Express host',
      });
      return;
    }
    res.json(await getCalCalendarSummary());
  } catch (err) {
    console.error('admin calendar summary:', err);
    res.status(500).json({ error: err.message || 'Failed to load Cal.diy calendar' });
  }
});

router.get('/calendar/bookings', async (req, res) => {
  try {
    if (!calConfigured()) {
      res.status(503).json({ error: 'CAL_DATABASE_URL is not set' });
      return;
    }
    const bookings = await listCalBookings({
      from: req.query.from,
      to: req.query.to,
      status: req.query.status,
    });
    res.json({ bookings, manage: calManageLinks() });
  } catch (err) {
    console.error('admin calendar bookings:', err);
    res.status(500).json({ error: err.message || 'Failed to load bookings' });
  }
});

router.get('/calendar/event-types', async (_req, res) => {
  try {
    if (!calConfigured()) {
      res.status(503).json({ error: 'CAL_DATABASE_URL is not set' });
      return;
    }
    res.json({ eventTypes: await listCalEventTypes(), manage: calManageLinks() });
  } catch (err) {
    console.error('admin calendar event-types:', err);
    res.status(500).json({ error: err.message || 'Failed to load event types' });
  }
});

/* ---------- Project inquiries (www marketing form) ---------- */
router.get('/inquiries', async (_req, res) => {
  const { rows } = await query(
    `SELECT i.id, i.name, i.email, i.company, i.categories, i.overview, i.answers, i.budget, i.timeline,
            i.status, i.source, i.cal_booking_uid, i.created_at
     FROM inquiry_submissions i
     ORDER BY i.created_at DESC LIMIT 200`,
  );
  res.json({ inquiries: rows });
});

router.get('/inquiries/:id', async (req, res) => {
  const { rows } = await query('SELECT * FROM inquiry_submissions WHERE id = $1', [req.params.id]);
  if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ inquiry: rows[0] });
});

router.patch('/inquiries/:id', async (req, res) => {
  const status = req.body.status ? String(req.body.status).trim() : null;
  const { rows } = await query(
    `UPDATE inquiry_submissions SET status = COALESCE($1, status) WHERE id = $2 RETURNING *`,
    [status, req.params.id],
  );
  if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ inquiry: rows[0] });
});

/* ---------- Tickets ---------- */
router.get('/tickets', async (_req, res) => {
  const { rows } = await query(
    `SELECT t.*, u.name AS user_name
     FROM support_tickets t
     LEFT JOIN users u ON u.id = t.user_id
     ORDER BY t.created_at DESC LIMIT 200`,
  );
  res.json({ tickets: rows });
});

router.get('/tickets/:id', async (req, res) => {
  const { rows } = await query('SELECT * FROM support_tickets WHERE id = $1', [req.params.id]);
  if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
  const { rows: messages } = await query(
    `SELECT * FROM ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC`,
    [req.params.id],
  );
  res.json({ ticket: rows[0], messages });
});

router.patch('/tickets/:id', async (req, res) => {
  const { status, priority, category } = req.body;
  const { rows } = await query(
    `UPDATE support_tickets SET
      status = COALESCE($1, status),
      priority = COALESCE($2, priority),
      category = COALESCE($3, category)
     WHERE id = $4 RETURNING *`,
    [status, priority, category, req.params.id],
  );
  if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ ticket: rows[0] });
});

router.post('/tickets/:id/messages', async (req, res) => {
  const body = String(req.body.body || '').trim();
  if (!body) { res.status(400).json({ error: 'Message required' }); return; }
  const { rows } = await query(
    `INSERT INTO ticket_messages (ticket_id, sender, body) VALUES ($1, 'staff', $2) RETURNING *`,
    [req.params.id, body],
  );
  res.status(201).json({ message: rows[0] });
});

/* ---------- Newsletter ---------- */
router.get('/newsletter', async (_req, res) => {
  const { rows } = await query('SELECT * FROM newsletter_subscribers ORDER BY created_at DESC');
  res.json({ subscribers: rows });
});

router.delete('/newsletter/:id', async (req, res) => {
  await query('DELETE FROM newsletter_subscribers WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

router.get('/newsletter/sends', async (_req, res) => {
  const { rows } = await query(
    'SELECT * FROM newsletter_sends ORDER BY sent_at DESC LIMIT 20',
  );
  res.json({ sends: rows });
});

router.post('/newsletter/send', async (req, res) => {
  try {
    const subject = String(req.body.subject || '').trim();
    const body = String(req.body.body || req.body.text || '').trim();
    const testEmail = req.body.testEmail ? String(req.body.testEmail).trim().toLowerCase() : null;

    if (!subject || !body) {
      res.status(400).json({ error: 'Subject and body required' });
      return;
    }

    let recipients;
    if (testEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
        res.status(400).json({ error: 'Invalid test email' });
        return;
      }
      recipients = [testEmail];
    } else {
      const { rows } = await query(
        `SELECT email FROM newsletter_subscribers WHERE unsubscribed_at IS NULL ORDER BY id`,
      );
      recipients = rows.map((r) => r.email);
      if (!recipients.length) {
        res.status(400).json({ error: 'No active subscribers' });
        return;
      }
    }

    const results = await sendNewsletterBroadcast({ subject, body, recipients });

    if (!testEmail) {
      await query(
        `INSERT INTO newsletter_sends (subject, body_text, recipient_count, failed_count)
         VALUES ($1,$2,$3,$4)`,
        [subject, body, results.sent, results.failed],
      );
    }

    res.json({ ok: true, ...results, total: recipients.length });
  } catch (err) {
    console.error('newsletter send:', err);
    res.status(500).json({ error: 'Send failed' });
  }
});

/* ---------- Stripe settings ---------- */
router.get('/stripe/settings', async (_req, res) => {
  try {
    const { rows } = await query('SELECT * FROM stripe_settings WHERE id = 1');
    const hasSecret = !!process.env.STRIPE_SECRET_KEY;
    const hasWebhook = !!process.env.STRIPE_WEBHOOK_SECRET;
    res.json({
      settings: rows[0] || {},
      configured: hasSecret,
      webhookConfigured: hasWebhook,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    });
  } catch (err) {
    console.error('admin stripe settings:', err);
    res.status(500).json({ error: 'Failed to load Stripe settings' });
  }
});

router.put('/stripe/settings', async (req, res) => {
  try {
    const b = req.body;
    const { rows } = await query(
      `UPDATE stripe_settings SET
        publishable_key = COALESCE($1, publishable_key),
        connect_enabled = COALESCE($2, connect_enabled),
        blitz_price_cents = COALESCE($3, blitz_price_cents),
        updated_at = now()
       WHERE id = 1 RETURNING *`,
      [b.publishable_key, b.connect_enabled, b.blitz_price_cents],
    );
    res.json({ settings: rows[0] });
  } catch (err) {
    console.error('admin stripe update:', err);
    res.status(500).json({ error: 'Failed to update Stripe settings' });
  }
});

router.get('/stripe/subscriptions', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT hs.*, u.email AS user_email, u.name AS user_name
       FROM hosting_subscriptions hs
       LEFT JOIN users u ON u.id = hs.user_id
       ORDER BY hs.created_at DESC LIMIT 100`,
    );
    res.json({ subscriptions: rows });
  } catch (err) {
    console.error('admin subscriptions:', err);
    res.status(500).json({ error: 'Failed to load subscriptions' });
  }
});

/* ---------- Quotes ---------- */
function generateQuoteId() {
  return `CB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function normalizeQuoteBody(b) {
  const items = Array.isArray(b.line_items) ? b.line_items : [];
  const total = Math.max(0, Math.round(Number(b.total_cents) || 0));
  const depositPct = Math.min(100, Math.max(0, Math.round(Number(b.deposit_pct) || 25)));
  const deposit = b.deposit_cents != null
    ? Math.max(0, Math.round(Number(b.deposit_cents)))
    : Math.round((total * depositPct) / 100);
  const rawPromo = b.promo_code != null ? String(b.promo_code).trim().toUpperCase() : '';
  return {
    client_name: b.client_name ? String(b.client_name).trim() : null,
    client_email: String(b.client_email || '').trim().toLowerCase(),
    company: b.company ? String(b.company).trim() : null,
    category: b.category ? String(b.category).trim() : null,
    tier: b.tier ? String(b.tier).trim() : null,
    line_items: JSON.stringify(items),
    answers: JSON.stringify(b.answers || {}),
    notes: JSON.stringify(b.notes || {}),
    subtotal_cents: total,
    total_cents: total,
    deposit_cents: deposit,
    deposit_pct: depositPct,
    inquiry_id: b.inquiry_id ? Number(b.inquiry_id) : null,
    promo_code: rawPromo || null,
  };
}

router.get('/quotes', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, public_id, client_name, client_email, company, category, tier,
              total_cents, deposit_cents, deposit_pct, status, inquiry_id, paid_at, created_at
       FROM quotes ORDER BY created_at DESC LIMIT 200`,
    );
    res.json({ quotes: rows });
  } catch (err) {
    console.error('admin quotes list:', err);
    res.status(500).json({ error: 'Failed to load quotes' });
  }
});

router.get('/quotes/:id', async (req, res) => {
  const { rows } = await query('SELECT * FROM quotes WHERE id = $1', [req.params.id]);
  if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ quote: rows[0], link: quoteLink(rows[0].public_id) });
});

router.post('/quotes', async (req, res) => {
  try {
    const q = normalizeQuoteBody(req.body);
    if (!q.client_email || !q.client_email.includes('@')) {
      res.status(400).json({ error: 'Valid client email required' });
      return;
    }
    if (q.promo_code === EARLYBIRD_CODE) {
      await assertEarlyBirdQuoteSlot();
    }
    const publicId = generateQuoteId();
    const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const { rows } = await query(
      `INSERT INTO quotes
        (public_id, client_name, client_email, company, category, tier, line_items, answers, notes,
         subtotal_cents, total_cents, deposit_cents, deposit_pct, inquiry_id, valid_until, created_by, status, promo_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,'draft',$17)
       RETURNING *`,
      [publicId, q.client_name, q.client_email, q.company, q.category, q.tier, q.line_items, q.answers, q.notes,
        q.subtotal_cents, q.total_cents, q.deposit_cents, q.deposit_pct, q.inquiry_id, validUntil, req.userId, q.promo_code],
    );
    res.status(201).json({ quote: rows[0], link: quoteLink(publicId) });
  } catch (err) {
    console.error('admin quote create:', err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Failed to create quote' });
  }
});

router.patch('/quotes/:id', async (req, res) => {
  try {
    const b = req.body;
    const status = b.status && ['draft', 'sent', 'paid'].includes(b.status) ? b.status : null;
    // Full re-save when line items provided; otherwise light status/contact update.
    if (Array.isArray(b.line_items)) {
      const q = normalizeQuoteBody(b);
      if (q.promo_code === EARLYBIRD_CODE) {
        const { rows: existing } = await query('SELECT promo_code FROM quotes WHERE id = $1', [req.params.id]);
        const already = existing[0] && String(existing[0].promo_code || '').toUpperCase() === EARLYBIRD_CODE;
        if (!already) await assertEarlyBirdQuoteSlot();
      }
      const { rows } = await query(
        `UPDATE quotes SET
           client_name=$1, client_email=COALESCE($2, client_email), company=$3, category=$4, tier=$5,
           line_items=$6::jsonb, answers=$7::jsonb, notes=$8::jsonb,
           subtotal_cents=$9, total_cents=$10, deposit_cents=$11, deposit_pct=$12,
           status=COALESCE($13, status), promo_code=$14, updated_at=now()
         WHERE id=$15 RETURNING *`,
        [q.client_name, q.client_email || null, q.company, q.category, q.tier,
          q.line_items, q.answers, q.notes, q.subtotal_cents, q.total_cents, q.deposit_cents, q.deposit_pct,
          status, q.promo_code, req.params.id],
      );
      if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
      res.json({ quote: rows[0] });
      return;
    }
    const { rows } = await query(
      `UPDATE quotes SET status = COALESCE($1, status), updated_at = now() WHERE id = $2 RETURNING *`,
      [status, req.params.id],
    );
    if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ quote: rows[0] });
  } catch (err) {
    console.error('admin quote update:', err);
    res.status(500).json({ error: 'Failed to update quote' });
  }
});

router.post('/quotes/:id/send', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM quotes WHERE id = $1', [req.params.id]);
    const quote = rows[0];
    if (!quote) { res.status(404).json({ error: 'Not found' }); return; }
    const emailResult = await sendQuoteToClient(quote);
    const nextStatus = quote.status === 'paid' ? 'paid' : 'sent';
    const { rows: updated } = await query(
      `UPDATE quotes SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [nextStatus, req.params.id],
    );
    res.json({ quote: updated[0], emailed: emailResult.ok !== false, link: quoteLink(quote.public_id) });
  } catch (err) {
    console.error('admin quote send:', err);
    res.status(500).json({ error: 'Failed to send quote' });
  }
});

router.delete('/quotes/:id', async (req, res) => {
  await query('DELETE FROM quotes WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

/* ---------- Merch orders ---------- */
router.get('/orders', async (_req, res) => {
  const { rows } = await query(
    `SELECT o.*,
      COALESCE(
        json_agg(
          json_build_object(
            'product_name', i.product_name,
            'variant_label', i.variant_label,
            'quantity', i.quantity,
            'line_total_cents', i.line_total_cents
          ) ORDER BY i.id
        ) FILTER (WHERE i.id IS NOT NULL),
        '[]'
      ) AS items
     FROM merch_orders o
     LEFT JOIN merch_order_items i ON i.order_id = o.id
     GROUP BY o.id
     ORDER BY o.created_at DESC
     LIMIT 100`,
  );
  res.json({ orders: rows });
});

router.post('/sim-client-invite', async (req, res) => {
  try {
    const { sendSimClientInvite } = await import('../lib/platformTenant.js');
    const result = await sendSimClientInvite({
      email: req.body.email,
      name: req.body.name,
      businessName: req.body.businessName,
      slug: req.body.slug,
      tier: req.body.tier || 'signature',
    });
    res.json({
      ok: true,
      onboardingUrl: result.onboardingUrl,
      tenantSlug: result.tenant.slug,
      devToken: process.env.NODE_ENV !== 'production' ? result.devToken : undefined,
    });
  } catch (err) {
    console.error('sim-client-invite:', err);
    res.status(500).json({ error: err.message || 'Invite failed' });
  }
});

/* ---------- Miranda live chat ---------- */

router.get('/chat/awaiting-count', async (_req, res) => {
  try {
    const count = await countAwaitingThreads();
    res.json({ count });
  } catch (err) {
    console.error('admin chat count:', err);
    res.status(500).json({ error: 'Failed to load count' });
  }
});

router.get('/chat/threads', async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : 'all';
    const threads = await listThreadsAdmin({ status });
    res.json({ threads });
  } catch (err) {
    console.error('admin chat list:', err);
    res.status(500).json({ error: 'Failed to load threads' });
  }
});

router.get('/chat/threads/:id', async (req, res) => {
  try {
    const thread = await getThreadById(req.params.id);
    if (!thread) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const messages = await listAllMessages(thread.id);
    res.json({ thread, messages });
  } catch (err) {
    console.error('admin chat get:', err);
    res.status(500).json({ error: 'Failed to load thread' });
  }
});

router.post('/chat/threads/:id/accept', async (req, res) => {
  try {
    const thread = await claimThread(req.params.id, 'ryan');
    if (!thread) {
      res.status(404).json({ error: 'Not found or not claimable' });
      return;
    }
    await insertMessage({
      threadId: thread.id,
      role: 'system',
      body: 'Ryan joined the chat.',
    });
    const messages = await listAllMessages(thread.id);
    res.json({ thread, messages });
  } catch (err) {
    console.error('admin chat accept:', err);
    res.status(500).json({ error: 'Failed to accept chat' });
  }
});

router.post('/chat/threads/:id/release', async (req, res) => {
  try {
    const thread = await releaseToMiranda(req.params.id);
    if (!thread) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    await insertMessage({
      threadId: thread.id,
      role: 'system',
      body: 'Ryan handed you back to Miranda.',
    });
    await insertMessage({
      threadId: thread.id,
      role: 'miranda',
      body: "Ryan stepped away — I'm still here if you need pricing, Free Service Audits, or to book a Discovery Call.",
    });
    const messages = await listAllMessages(thread.id);
    res.json({ thread, messages });
  } catch (err) {
    console.error('admin chat release:', err);
    res.status(500).json({ error: 'Failed to release chat' });
  }
});

router.post('/chat/threads/:id/close', async (req, res) => {
  try {
    const thread = await closeThread(req.params.id);
    if (!thread) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    await insertMessage({
      threadId: thread.id,
      role: 'system',
      body: 'Chat closed.',
    });
    const messages = await listAllMessages(thread.id);
    res.json({ thread, messages });
  } catch (err) {
    console.error('admin chat close:', err);
    res.status(500).json({ error: 'Failed to close chat' });
  }
});

router.post('/chat/threads/:id/messages', async (req, res) => {
  try {
    const body = String(req.body.body || '').trim();
    if (!body) {
      res.status(400).json({ error: 'Message required' });
      return;
    }
    const thread = await getThreadById(req.params.id);
    if (!thread) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (thread.status !== 'live') {
      res.status(409).json({ error: 'Accept the chat before replying' });
      return;
    }
    await insertMessage({ threadId: thread.id, role: 'ryan', body });
    const messages = await listAllMessages(thread.id);
    res.json({ thread: await getThreadById(thread.id), messages });
  } catch (err) {
    console.error('admin chat reply:', err);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

export default router;
