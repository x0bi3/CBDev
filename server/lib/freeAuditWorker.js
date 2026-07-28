import { randomBytes } from 'node:crypto';
import { query } from '../db.js';
import { collectAndNormalize } from './freeAuditCollect.js';
import {
  sendFreeAuditReady,
  notifyFreeAuditReady,
  notifyFreeAuditWaitlist,
} from './email.js';
import { URLS } from './urls.js';

export function newPublicToken() {
  return randomBytes(18).toString('base64url');
}

export function normalizeAuditUrl(raw) {
  let s = String(raw || '').trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(u.protocol)) return null;
  if (!u.hostname.includes('.')) return null;
  u.hash = '';
  return u.toString();
}

export function reportPublicUrl(token) {
  return `${URLS.www}/report/${token}`;
}

export async function enqueueFreeAudit({ name, email, url, inquiryId = null }) {
  const token = newPublicToken();
  const { rows } = await query(
    `INSERT INTO free_audit_reports (public_token, inquiry_id, name, email, url, status)
     VALUES ($1, $2, $3, $4, $5, 'queued')
     RETURNING id, public_token, name, email, url, status, created_at`,
    [token, inquiryId, name, email, url],
  );
  const report = rows[0];

  // No client "queued" email — only admin lead + client ready when done.

  setImmediate(() => {
    runFreeAuditJob(report.id).catch((err) => {
      console.error('free-audit: job failed', err);
    });
  });

  return report;
}

export async function runFreeAuditJob(reportId) {
  const { rows } = await query(`SELECT * FROM free_audit_reports WHERE id = $1`, [reportId]);
  const report = rows[0];
  if (!report) return;

  await query(`UPDATE free_audit_reports SET status = 'running' WHERE id = $1`, [reportId]);
  console.log(`free-audit: running #${reportId} ${report.url}`);

  try {
    const result = await collectAndNormalize(report.url, { reportToken: report.public_token });
    const { rows: updated } = await query(
      `UPDATE free_audit_reports
       SET status = 'ready',
           scores = $2::jsonb,
           sections = $3::jsonb,
           raw = $4::jsonb,
           error = NULL,
           ready_at = NOW(),
           expires_at = NOW() + INTERVAL '24 hours'
       WHERE id = $1
       RETURNING id, public_token, name, email, url, status, scores, ready_at, expires_at`,
      [
        reportId,
        JSON.stringify(result.scores),
        JSON.stringify({
          overview: result.overview,
          sections: result.sections,
          sectionOrder: result.sectionOrder,
          meta: result.meta,
        }),
        JSON.stringify(result.raw),
      ],
    );

    const ready = updated[0] || {
      ...report,
      status: 'ready',
      scores: result.scores,
      public_token: report.public_token,
    };
    // Ensure scores object available for email helpers
    ready.scores = result.scores;

    // Exactly two emails: admin lead first, then client ready
    await notifyFreeAuditReady(ready);
    await sendFreeAuditReady(ready);
    console.log(`free-audit: ready #${reportId} overall=${result.scores?.overall}`);
  } catch (err) {
    await query(
      `UPDATE free_audit_reports SET status = 'failed', error = $2 WHERE id = $1`,
      [reportId, String(err.message || err).slice(0, 2000)],
    );
    console.error(`free-audit: failed #${reportId}`, err);
    notifyFreeAuditReady({
      ...report,
      status: 'failed',
      scores: {},
      error: String(err.message || err),
    }).catch(() => {});
  }
}

export async function addWaitlist({ serviceSlug, name, email }) {
  const { rows } = await query(
    `INSERT INTO free_audit_waitlist (service_slug, name, email)
     VALUES ($1, $2, $3)
     RETURNING id, service_slug, name, email, created_at`,
    [serviceSlug, name || null, email],
  );
  const row = rows[0];
  notifyFreeAuditWaitlist(row).catch((err) => {
    console.error('free-audit: waitlist notify failed', err);
  });
  return row;
}

export async function getReportByToken(token) {
  const { rows } = await query(
    `SELECT id, public_token, name, email, url, status, scores, sections, error, created_at, ready_at, expires_at
     FROM free_audit_reports WHERE public_token = $1`,
    [token],
  );
  return rows[0] || null;
}

export async function logCtaEvent({ reportId, section, destination }) {
  await query(
    `INSERT INTO free_audit_cta_events (report_id, section, destination)
     VALUES ($1, $2, $3)`,
    [reportId, section, destination],
  );
}
