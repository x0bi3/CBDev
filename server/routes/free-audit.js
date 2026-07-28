import { Router } from 'express';
import { query } from '../db.js';
import {
  enqueueFreeAudit,
  normalizeAuditUrl,
  addWaitlist,
  getReportByToken,
  logCtaEvent,
  reportPublicUrl,
} from '../lib/freeAuditWorker.js';

const router = Router();

const hits = new Map();
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 6;

const ALLOWED_WAITLIST = new Set([
  'web-apps',
  'mobile',
  'automations',
  'custom',
  'stores',
  'dashboards',
  'maintenance',
]);

function rateLimited(ip) {
  const now = Date.now();
  const bucket = hits.get(ip) || [];
  const recent = bucket.filter((t) => t > now - RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function clientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

/** POST /api/free-audit — start automated website report */
router.post('/', async (req, res) => {
  try {
    const ip = clientIp(req);
    if (rateLimited(ip)) {
      res.status(429).json({ error: 'Too many audit requests. Try again later or email hello@creativebuilds.dev.' });
      return;
    }

    // honeypot
    if (req.body.company_website || req.body.website_hp) {
      res.status(201).json({ ok: true });
      return;
    }

    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const url = normalizeAuditUrl(req.body.url || req.body.siteUrl || '');

    if (!name || name.length < 2) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Valid email is required' });
      return;
    }
    if (!url) {
      res.status(400).json({ error: 'A valid website URL is required' });
      return;
    }

    let inquiryId = null;
    try {
      const { rows } = await query(
        `INSERT INTO inquiry_submissions (name, email, company, categories, overview, answers, budget, timeline, source)
         VALUES ($1, $2, NULL, $3::jsonb, $4, $5::jsonb, $6, $7, $8)
         RETURNING id`,
        [
          name,
          email,
          JSON.stringify(['audits']),
          `[Free Website Audit] ${url}`,
          JSON.stringify({ url, product: 'free-website-audit' }),
          'not-sure',
          'exploratory',
          'free-website-audit',
        ],
      );
      inquiryId = rows[0]?.id ?? null;
    } catch (err) {
      console.error('free-audit: inquiry insert failed', err.message);
    }

    const report = await enqueueFreeAudit({ name, email, url, inquiryId });
    res.status(201).json({
      ok: true,
      token: report.public_token,
      status: report.status,
      reportUrl: reportPublicUrl(report.public_token),
    });
  } catch (err) {
    console.error('free-audit create:', err);
    res.status(500).json({ error: 'Failed to start free audit' });
  }
});

/** POST /api/free-audit/waitlist */
router.post('/waitlist', async (req, res) => {
  try {
    if (rateLimited(clientIp(req))) {
      res.status(429).json({ error: 'Too many requests. Try again later.' });
      return;
    }
    if (req.body.company_website || req.body.website_hp) {
      res.status(201).json({ ok: true });
      return;
    }

    const serviceSlug = String(req.body.service || req.body.service_slug || '').trim();
    const name = req.body.name ? String(req.body.name).trim() : '';
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!ALLOWED_WAITLIST.has(serviceSlug)) {
      res.status(400).json({ error: 'Unknown service for waitlist' });
      return;
    }
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Valid email is required' });
      return;
    }

    const row = await addWaitlist({ serviceSlug, name, email });
    res.status(201).json({ ok: true, id: row.id });
  } catch (err) {
    console.error('free-audit waitlist:', err);
    res.status(500).json({ error: 'Failed to join waitlist' });
  }
});

/** GET /api/free-audit/:token */
router.get('/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!token || token.length < 10) {
      res.status(400).json({ error: 'Invalid token' });
      return;
    }
    const report = await getReportByToken(token);
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    const expiresAt = report.expires_at ? new Date(report.expires_at) : null;
    const isExpired =
      report.status === 'ready' && expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now();

    if (isExpired) {
      res.json({
        ok: true,
        token: report.public_token,
        url: report.url,
        name: report.name,
        status: 'expired',
        scores: report.scores || {},
        sections: {
          overview: {
            headline: 'This free report has expired',
            summary:
              'Free report links expire after 24 hours. Run a fresh audit anytime — or book a call if you want a deeper written review.',
            sectionsNav: (report.scores?.bySection
              ? Object.entries(report.scores.bySection).map(([id, score]) => ({
                  id,
                  title: id,
                  score,
                  scoreLabel: typeof score === 'number' && score >= 90 ? 'strong' : 'scored',
                }))
              : []),
          },
        },
        error: null,
        createdAt: report.created_at,
        readyAt: report.ready_at,
        expiresAt: report.expires_at,
        reportUrl: reportPublicUrl(report.public_token),
      });
      return;
    }

    res.json({
      ok: true,
      token: report.public_token,
      url: report.url,
      name: report.name,
      status: report.status,
      scores: report.scores || {},
      sections: report.sections || {},
      error: report.status === 'failed' ? report.error : null,
      createdAt: report.created_at,
      readyAt: report.ready_at,
      expiresAt: report.expires_at,
      reportUrl: reportPublicUrl(report.public_token),
    });
  } catch (err) {
    console.error('free-audit get:', err);
    res.status(500).json({ error: 'Failed to load report' });
  }
});

/** POST /api/free-audit/:token/cta */
router.post('/:token/cta', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    const section = String(req.body.section || '').trim().slice(0, 64);
    const destination = String(req.body.destination || 'inquiry').trim().slice(0, 64);
    if (!token || !section) {
      res.status(400).json({ error: 'token and section required' });
      return;
    }
    const report = await getReportByToken(token);
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    await logCtaEvent({ reportId: report.id, section, destination });
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('free-audit cta:', err);
    res.status(500).json({ error: 'Failed to log CTA' });
  }
});

export default router;
