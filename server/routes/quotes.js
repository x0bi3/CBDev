import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

/** Public client view of a quote by its URL token. Only sent/paid quotes are visible. */
router.get('/:public_id', async (req, res) => {
  try {
    const publicId = String(req.params.public_id || '').trim();
    if (!publicId) { res.status(400).json({ error: 'Quote id required' }); return; }

    const { rows } = await query(
      `SELECT public_id, client_name, client_email, company, category, tier,
              line_items, total_cents, deposit_cents, deposit_pct, status, paid_at, valid_until
       FROM quotes WHERE public_id = $1`,
      [publicId],
    );
    const quote = rows[0];
    if (!quote || quote.status === 'draft') {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }
    res.json({ quote });
  } catch (err) {
    console.error('public quote fetch:', err);
    res.status(500).json({ error: 'Failed to load quote' });
  }
});

export default router;
