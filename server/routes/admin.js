import { Router } from 'express';
import { query } from '../db.js';
import { requireAdmin } from '../auth.js';

const router = Router();
router.use(requireAdmin);

function slugify(text) {
  return String(text).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
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
    `SELECT id, slug, name, category_slug, price_cents, description, color, images, variants, active, sort_order
     FROM products ORDER BY sort_order, id`,
  );
  res.json({ products: rows });
});

router.post('/products', async (req, res) => {
  const b = req.body;
  const slug = b.slug || slugify(b.name);
  const { rows } = await query(
    `INSERT INTO products (slug, name, category_slug, price_cents, description, color, images, variants, active, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10) RETURNING *`,
    [slug, b.name, b.category_slug || b.cat || 'apparel', b.price_cents ?? (b.price * 100), b.description || '',
      b.color || 'from-indigo-500 to-violet-700', JSON.stringify(b.images || []), JSON.stringify(b.variants || {}),
      b.active !== false, b.sort_order ?? 0],
  );
  res.status(201).json({ product: rows[0] });
});

router.put('/products/:id', async (req, res) => {
  const b = req.body;
  const { rows } = await query(
    `UPDATE products SET slug=$1, name=$2, category_slug=$3, price_cents=$4, description=$5, color=$6,
      images=$7::jsonb, variants=$8::jsonb, active=$9, sort_order=$10 WHERE id=$11 RETURNING *`,
    [b.slug, b.name, b.category_slug, b.price_cents, b.description, b.color,
      JSON.stringify(b.images || []), JSON.stringify(b.variants || {}), b.active !== false, b.sort_order ?? 0, req.params.id],
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
  const { rows } = await query('SELECT * FROM blog_posts ORDER BY published_at DESC NULLS LAST, id DESC');
  res.json({ posts: rows });
});

router.post('/blog', async (req, res) => {
  const b = req.body;
  const slug = b.slug || slugify(b.title);
  const { rows } = await query(
    `INSERT INTO blog_posts (slug, title, excerpt, body, read_time, status, published_at)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7) RETURNING *`,
    [slug, b.title, b.excerpt || '', JSON.stringify(b.body || []), b.read_time || '',
      b.status || 'draft', b.published_at || null],
  );
  res.status(201).json({ post: rows[0] });
});

router.put('/blog/:id', async (req, res) => {
  const b = req.body;
  const { rows } = await query(
    `UPDATE blog_posts SET slug=$1, title=$2, excerpt=$3, body=$4::jsonb, read_time=$5, status=$6, published_at=$7
     WHERE id=$8 RETURNING *`,
    [b.slug, b.title, b.excerpt, JSON.stringify(b.body || []), b.read_time, b.status, b.published_at, req.params.id],
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

/* ---------- Home apps ---------- */
router.get('/home-apps', async (_req, res) => {
  const { rows } = await query('SELECT * FROM home_apps ORDER BY screen, sort_order, id');
  res.json({ apps: rows });
});

router.post('/home-apps', async (req, res) => {
  const b = req.body;
  const { rows } = await query(
    `INSERT INTO home_apps (app_id, label, glyph, tile, screen, portfolio_slug, sort_order, requires_auth, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [b.app_id, b.label, b.glyph || '📱', b.tile, b.screen || 'home', b.portfolio_slug || null, b.sort_order ?? 0, !!b.requires_auth, b.active !== false],
  );
  res.status(201).json({ app: rows[0] });
});

router.put('/home-apps/:id', async (req, res) => {
  const b = req.body;
  const { rows } = await query(
    `UPDATE home_apps SET app_id=$1, label=$2, glyph=$3, tile=$4, screen=$5, portfolio_slug=$6, sort_order=$7, requires_auth=$8, active=$9
     WHERE id=$10 RETURNING *`,
    [b.app_id, b.label, b.glyph, b.tile, b.screen, b.portfolio_slug || null, b.sort_order ?? 0, !!b.requires_auth, b.active !== false, req.params.id],
  );
  if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
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

export default router;
