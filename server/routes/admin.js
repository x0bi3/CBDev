import { Router } from 'express';
import { query } from '../db.js';
import { requireAdmin } from '../auth.js';
import { productImageUpload } from '../lib/uploads.js';
import { sanitizeHtml, resolveBodyHtml } from '../lib/blogHtml.js';
import { runBlogAssist } from '../lib/blogWritingAssist.js';
import { refreshBlogIdeasNow } from '../lib/blogIdeasScheduler.js';
import { sendNewsletterBroadcast } from '../lib/email.js';

const router = Router();
router.use(requireAdmin);

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

async function ensureUniqueSlug(baseSlug, excludeId = null) {
  const normalized = String(baseSlug || 'post').slice(0, 120) || 'post';
  const check = async (slug) => {
    const params = excludeId ? [slug, excludeId] : [slug];
    const sql = excludeId
      ? 'SELECT 1 FROM blog_posts WHERE slug = $1 AND id != $2 LIMIT 1'
      : 'SELECT 1 FROM blog_posts WHERE slug = $1 LIMIT 1';
    const { rows } = await query(sql, params);
    return rows.length > 0;
  };

  if (!(await check(normalized))) return normalized;
  for (let n = 2; n < 100; n++) {
    const candidate = `${normalized.slice(0, 110)}-${n}`;
    if (!(await check(candidate))) return candidate;
  }
  return `${normalized.slice(0, 100)}-${Date.now()}`;
}

router.get('/stats', async (_req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        (SELECT count(*)::int FROM products WHERE active) AS products,
        (SELECT count(*)::int FROM blog_posts) AS blog_posts,
        (SELECT count(*)::int FROM portfolio_projects WHERE active) AS portfolio,
        (SELECT count(*)::int FROM support_tickets WHERE status = 'open') AS open_tickets,
        (SELECT count(*)::int FROM bookings WHERE status = 'confirmed' AND starts_at >= now()) AS upcoming_bookings,
        (SELECT count(*)::int FROM newsletter_subscribers) AS subscribers
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

/* ---------- Blog ---------- */
router.get('/blog', async (_req, res) => {
  try {
    const { rows } = await query('SELECT * FROM blog_posts ORDER BY published_at DESC NULLS LAST, id DESC');
    res.json({
      posts: rows.map((row) => ({
        ...row,
        body_html: resolveBodyHtml(row),
      })),
    });
  } catch (err) {
    console.error('admin blog list:', err);
    res.status(500).json({ error: 'Failed to load posts' });
  }
});

router.post('/blog/assist', async (req, res) => {
  try {
    const result = await runBlogAssist(req.body || {});
    res.json(result);
  } catch (err) {
    console.error('blog assist:', err);
    res.status(500).json({ error: err.message || 'Assist failed' });
  }
});

router.get('/blog/ideas', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM blog_ideas WHERE status = 'suggested' ORDER BY score DESC, created_at DESC LIMIT 30`,
    );
    res.json({ ideas: rows });
  } catch (err) {
    console.error('blog ideas list:', err);
    res.status(500).json({ error: 'Failed to load ideas' });
  }
});

router.post('/blog/ideas/refresh', async (_req, res) => {
  try {
    const result = await refreshBlogIdeasNow();
    res.json(result);
  } catch (err) {
    if (err.code === 'BUSY') {
      res.status(409).json({ error: err.message });
      return;
    }
    console.error('blog ideas refresh:', err);
    res.status(500).json({ error: err.message || 'Refresh failed' });
  }
});

router.post('/blog/ideas/:id/dismiss', async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE blog_ideas SET status = 'dismissed' WHERE id = $1 RETURNING *`,
      [req.params.id],
    );
    if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ idea: rows[0] });
  } catch (err) {
    console.error('blog idea dismiss:', err);
    res.status(500).json({ error: 'Failed to dismiss idea' });
  }
});

router.post('/blog/ideas/:id/use', async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE blog_ideas SET status = 'used', used_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id],
    );
    if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ idea: rows[0] });
  } catch (err) {
    console.error('blog idea use:', err);
    res.status(500).json({ error: 'Failed to mark idea used' });
  }
});

router.post('/blog', async (req, res) => {
  try {
    const b = req.body;
    const slug = await ensureUniqueSlug(b.slug || slugify(b.title));
    const bodyHtml = sanitizeHtml(b.body_html || '');
    const { rows } = await query(
      `INSERT INTO blog_posts (slug, title, excerpt, body, body_html, read_time, status, published_at)
       VALUES ($1,$2,$3,'[]'::jsonb,$4,$5,$6,$7) RETURNING *`,
      [slug, b.title, b.excerpt || '', bodyHtml, b.read_time || '',
        b.status || 'draft', b.published_at || null],
    );
    res.status(201).json({ post: { ...rows[0], body_html: bodyHtml } });
  } catch (err) {
    console.error('admin blog create:', err);
    res.status(500).json({ error: err.message || 'Failed to create post' });
  }
});

router.put('/blog/:id', async (req, res) => {
  try {
    const b = req.body;
    const slug = await ensureUniqueSlug(b.slug || slugify(b.title), Number(req.params.id));
    const bodyHtml = sanitizeHtml(b.body_html || '');
    const { rows } = await query(
      `UPDATE blog_posts SET slug=$1, title=$2, excerpt=$3, body_html=$4, read_time=$5, status=$6, published_at=$7
       WHERE id=$8 RETURNING *`,
      [slug, b.title, b.excerpt, bodyHtml, b.read_time, b.status, b.published_at, req.params.id],
    );
    if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ post: { ...rows[0], body_html: bodyHtml } });
  } catch (err) {
    console.error('admin blog update:', err);
    res.status(500).json({ error: err.message || 'Failed to update post' });
  }
});

router.post('/blog/:id/publish', async (req, res) => {
  const { rows } = await query(
    `UPDATE blog_posts SET status = 'published', published_at = COALESCE(published_at, NOW())
     WHERE id = $1 RETURNING *`,
    [req.params.id],
  );
  if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ post: rows[0] });
});

router.delete('/blog/:id', async (req, res) => {
  await query('DELETE FROM blog_posts WHERE id = $1', [req.params.id]);
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

/* ---------- Calendar ---------- */
router.get('/calendar/settings', async (_req, res) => {
  const { rows } = await query('SELECT * FROM availability_settings WHERE id = 1');
  res.json({ settings: rows[0] });
});

router.put('/calendar/settings', async (req, res) => {
  const b = req.body;
  const { rows } = await query(
    `UPDATE availability_settings SET timezone=$1, weekday_start=$2, weekday_end=$3,
      slot_interval_minutes=$4, work_weekdays=$5, blocked_dates=$6
     WHERE id=1 RETURNING *`,
    [b.timezone, b.weekday_start, b.weekday_end, b.slot_interval_minutes,
      b.work_weekdays, b.blocked_dates || []],
  );
  res.json({ settings: rows[0] });
});

router.get('/calendar/types', async (_req, res) => {
  const { rows } = await query('SELECT * FROM meeting_types ORDER BY sort_order, id');
  res.json({ types: rows });
});

router.post('/calendar/types', async (req, res) => {
  const b = req.body;
  const { rows } = await query(
    `INSERT INTO meeting_types (slug, label, duration_minutes, description, active, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [b.slug || slugify(b.label), b.label, b.duration_minutes, b.description || '', b.active !== false, b.sort_order ?? 0],
  );
  res.status(201).json({ type: rows[0] });
});

router.put('/calendar/types/:slug', async (req, res) => {
  const b = req.body;
  const { rows } = await query(
    `UPDATE meeting_types SET label=$1, duration_minutes=$2, description=$3, active=$4, sort_order=$5
     WHERE slug=$6 RETURNING *`,
    [b.label, b.duration_minutes, b.description, b.active !== false, b.sort_order ?? 0, req.params.slug],
  );
  if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ type: rows[0] });
});

router.delete('/calendar/types/:slug', async (req, res) => {
  await query('DELETE FROM meeting_types WHERE slug = $1', [req.params.slug]);
  res.json({ ok: true });
});

router.get('/calendar/bookings', async (_req, res) => {
  const { rows } = await query(
    `SELECT b.*, u.email AS user_email, u.name AS user_name, mt.label AS type_label
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     JOIN meeting_types mt ON mt.slug = b.meeting_type_slug
     ORDER BY b.starts_at DESC LIMIT 200`,
  );
  res.json({ bookings: rows });
});

router.delete('/calendar/bookings/:id', async (req, res) => {
  await query(`UPDATE bookings SET status = 'cancelled' WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
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

export default router;
