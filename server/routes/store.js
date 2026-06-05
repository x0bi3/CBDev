import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { STORE_CATALOG_WHERE, mapStoreAppRow } from '../lib/homeApps.js';

const router = Router();

router.get('/apps', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { rows } = await query(
      `SELECT h.app_id, h.label, h.glyph, h.tile, h.screen, h.portfolio_slug, h.sort_order,
              h.requires_auth, h.assign_users, h.launch_type, h.launch_url, h.auto_install,
              h.store_description, h.store_pricing, h.store_features, h.store_credits,
              (
                EXISTS (
                  SELECT 1 FROM user_home_apps u
                  WHERE u.home_app_id = h.id AND u.user_id = $1::int
                )
                OR h.auto_install = TRUE
              ) AS installed
       FROM home_apps h
       WHERE ${STORE_CATALOG_WHERE}
       ORDER BY h.sort_order, h.label, h.id`,
      [userId],
    );
    res.json({ apps: rows.map(mapStoreAppRow) });
  } catch (err) {
    console.error('store apps:', err);
    res.status(500).json({ error: 'Failed to load store' });
  }
});

async function findCatalogApp(appId) {
  const { rows } = await query(
    `SELECT id, app_id, requires_auth, assign_users, store_visible, active, auto_install
     FROM home_apps WHERE app_id = $1`,
    [appId],
  );
  return rows[0] || null;
}

async function userIsEligible(userId, app) {
  if (!app?.active || !app.store_visible || app.app_id === 'app-store') return false;
  if (app.requires_auth && !app.assign_users) return true;
  if (app.assign_users) {
    const { rows } = await query(
      `SELECT 1 FROM user_app_eligibility
       WHERE user_id = $1 AND home_app_id = $2`,
      [userId, app.id],
    );
    return rows.length > 0;
  }
  return false;
}

router.post('/apps/:appId/install', requireAuth, async (req, res) => {
  try {
    const app = await findCatalogApp(req.params.appId);
    if (!app) {
      res.status(404).json({ error: 'App not found' });
      return;
    }
    if (!await userIsEligible(req.userId, app)) {
      res.status(403).json({ error: 'Not eligible for this app' });
      return;
    }
    await query(
      `INSERT INTO user_home_apps (user_id, home_app_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.userId, app.id],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('store install:', err);
    res.status(500).json({ error: 'Install failed' });
  }
});

router.delete('/apps/:appId/uninstall', requireAuth, async (req, res) => {
  try {
    const app = await findCatalogApp(req.params.appId);
    if (!app) {
      res.status(404).json({ error: 'App not found' });
      return;
    }
    if (app.auto_install || (!app.assign_users && !app.requires_auth)) {
      res.status(400).json({ error: 'This app cannot be removed' });
      return;
    }
    await query(
      `DELETE FROM user_home_apps
       WHERE user_id = $1 AND home_app_id = $2`,
      [req.userId, app.id],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('store uninstall:', err);
    res.status(500).json({ error: 'Uninstall failed' });
  }
});

export default router;
