import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, '0')}`;
}

function mapPost(row) {
  return {
    id: row.slug,
    title: row.title,
    date: formatDate(row.published_at),
    read: row.read_time,
    excerpt: row.excerpt,
    body: row.body || [],
  };
}

router.get('/', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT slug, title, excerpt, body, read_time, published_at
       FROM blog_posts WHERE status = 'published'
       ORDER BY published_at DESC NULLS LAST, id DESC`,
    );
    res.json({ posts: rows.map(mapPost) });
  } catch (err) {
    console.error('blog list:', err);
    res.status(500).json({ error: 'Failed to load blog posts' });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT slug, title, excerpt, body, read_time, published_at
       FROM blog_posts WHERE slug = $1 AND status = 'published'`,
      [req.params.slug],
    );
    if (!rows[0]) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    res.json({ post: mapPost(rows[0]) });
  } catch (err) {
    console.error('blog get:', err);
    res.status(500).json({ error: 'Failed to load post' });
  }
});

router.post('/newsletter', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Valid email required' });
      return;
    }
    await query(
      `INSERT INTO newsletter_subscribers (email) VALUES ($1)
       ON CONFLICT (email) DO NOTHING`,
      [email],
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('newsletter:', err);
    res.status(500).json({ error: 'Subscription failed' });
  }
});

export default router;
