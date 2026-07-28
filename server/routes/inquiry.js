import { Router } from 'express';
import { query } from '../db.js';
import { notifyNewInquiry, sendInquiryConfirmation } from '../lib/email.js';
import { createLeadFollowUpBooking } from '../lib/cal.js';
import { URLS } from '../lib/urls.js';

const router = Router();

const hits = new Map();
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 8;

function rateLimited(ip) {
  const now = Date.now();
  const bucket = hits.get(ip) || [];
  const recent = bucket.filter((t) => t > now - RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function cleanCategories(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => String(c).trim()).filter(Boolean).slice(0, 8);
}

router.post('/', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    if (rateLimited(ip)) {
      res.status(429).json({ error: 'Too many submissions. Try again later or email hello@creativebuilds.dev.' });
      return;
    }

    if (req.body.company_website || req.body.website) {
      res.status(201).json({ ok: true });
      return;
    }

    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const company = req.body.company ? String(req.body.company).trim() : null;
    const categories = cleanCategories(req.body.categories);
    const overview = String(req.body.overview || '').trim();
    const answers = req.body.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
    const budget = req.body.budget ? String(req.body.budget).trim() : null;
    const timeline = req.body.timeline ? String(req.body.timeline).trim() : null;
    let source = req.body.source ? String(req.body.source).trim().slice(0, 64) : null;
    if (req.body.type === 'vibe-check') source = 'vibe-check';

    if (!name || name.length < 2) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Valid email is required' });
      return;
    }
    if (!categories.length) {
      res.status(400).json({ error: 'Select at least one category' });
      return;
    }
    if (!overview || overview.length < 10) {
      res.status(400).json({ error: 'Please add a brief overview (at least 10 characters)' });
      return;
    }

    const { rows } = await query(
      `INSERT INTO inquiry_submissions (name, email, company, categories, overview, answers, budget, timeline, source)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7, $8, $9)
       RETURNING id, name, email, company, categories, overview, answers, budget, timeline, source, status, created_at, cal_booking_uid`,
      [name, email, company, JSON.stringify(categories), overview, JSON.stringify(answers), budget, timeline, source],
    );
    const inquiry = rows[0];

    notifyNewInquiry(inquiry).catch((err) => {
      console.error('inquiry: notify failed', err);
    });
    sendInquiryConfirmation(inquiry).catch((err) => {
      console.error('inquiry: confirm failed', err);
    });

    // Async: Cal follow-up ≤24h
    setImmediate(async () => {
      try {
        const adminUrl = `${URLS.admin}#inquiry-${inquiry.id}`;
        await createLeadFollowUpBooking({ inquiry, adminUrl });
      } catch (err) {
        console.error('inquiry: follow-up pipeline failed', err);
      }
    });

    console.log(`inquiry-routes: new #${inquiry.id} from ${email} source=${source || 'inquiry'}`);
    res.status(201).json({ ok: true, id: inquiry.id });
  } catch (err) {
    console.error('inquiry create:', err);
    res.status(500).json({ error: 'Failed to submit inquiry' });
  }
});

export default router;
