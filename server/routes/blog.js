import { Router } from 'express';
import { query } from '../db.js';
import { sendNewsletterWelcome } from '../lib/email.js';

const router = Router();

/** Newsletter subscribe only — blog posts CMS removed (Content Engine replaces SEO content). */
router.post('/newsletter', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Valid email required' });
      return;
    }
    const { rows } = await query(
      `INSERT INTO newsletter_subscribers (email) VALUES ($1)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [email],
    );
    if (rows[0]) sendNewsletterWelcome(email).catch(() => {});
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('newsletter:', err);
    res.status(500).json({ error: 'Subscription failed' });
  }
});

router.get('/', (_req, res) => {
  res.json({ posts: [] });
});

router.get('/:slug', (_req, res) => {
  res.status(404).json({ error: 'Post not found' });
});

export default router;
