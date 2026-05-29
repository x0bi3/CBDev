import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

router.get('/apps', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT app_id, label, glyph, tile, screen, portfolio_slug, sort_order, requires_auth
       FROM home_apps WHERE active = TRUE ORDER BY screen, sort_order, id`,
    );
    const home = rows.filter((r) => r.screen === 'home').map(mapApp);
    const dock = rows.filter((r) => r.screen === 'dock').map(mapApp);
    res.json({ home, dock });
  } catch (err) {
    console.error('home apps:', err);
    res.status(500).json({ error: 'Failed to load apps' });
  }
});

function mapApp(row) {
  return {
    id: row.app_id,
    label: row.label,
    glyph: row.glyph,
    tile: row.tile,
    portfolioSlug: row.portfolio_slug,
    requiresAuth: row.requires_auth,
  };
}

export default router;
