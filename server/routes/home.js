import { Router } from 'express';
import { query } from '../db.js';
import { optionalAuth } from '../auth.js';
import { HOME_APPS_VISIBILITY, HOME_APP_SELECT, mapHomeAppRow } from '../lib/homeApps.js';

const router = Router();

router.get('/apps', optionalAuth, async (req, res) => {
  try {
    const userId = req.userId || null;
    const { rows } = await query(
      `SELECT ${HOME_APP_SELECT}
       FROM home_apps
       WHERE ${HOME_APPS_VISIBILITY}
       ORDER BY screen, sort_order, id`,
      [userId],
    );
    const home = rows.filter((r) => r.screen === 'home').map(mapHomeAppRow);
    const dock = rows.filter((r) => r.screen === 'dock').map(mapHomeAppRow);
    res.json({ home, dock });
  } catch (err) {
    console.error('home apps:', err);
    res.status(500).json({ error: 'Failed to load apps' });
  }
});

export default router;
