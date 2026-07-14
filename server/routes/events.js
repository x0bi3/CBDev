import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

const hits = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 120;

function rateLimited(ip) {
  const now = Date.now();
  const bucket = hits.get(ip) || [];
  const recent = bucket.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

const ALLOWED_EVENTS = new Set(['page_view', 'page_exit', 'funnel_step', 'contact_intent']);

router.post('/', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    if (rateLimited(ip)) {
      res.status(429).json({ error: 'Rate limited' });
      return;
    }

    const sessionId = String(req.body.session_id || '').trim().slice(0, 64);
    const path = String(req.body.path || '/').trim().slice(0, 512);
    const event = String(req.body.event || '').trim().slice(0, 64);
    const dwellMs = req.body.dwell_ms != null ? Math.min(86400000, Math.max(0, Number(req.body.dwell_ms))) : null;
    const referrer = req.body.referrer ? String(req.body.referrer).trim().slice(0, 512) : null;
    const meta = req.body.meta && typeof req.body.meta === 'object' ? req.body.meta : {};

    if (!sessionId || !event || !ALLOWED_EVENTS.has(event)) {
      res.status(400).json({ error: 'Invalid event payload' });
      return;
    }

    await query(
      `INSERT INTO event_log (session_id, path, event, dwell_ms, referrer, meta)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [sessionId, path, event, dwellMs, referrer, JSON.stringify(meta)],
    );

    res.status(204).end();
  } catch (err) {
    console.error('events create:', err);
    res.status(500).json({ error: 'Failed to record event' });
  }
});

export default router;
