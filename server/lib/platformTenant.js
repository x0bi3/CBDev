import crypto from 'node:crypto';
import { query } from '../db.js';

function cuid() {
  return `c${crypto.randomBytes(12).toString('hex')}`;
}

function slugify(name) {
  return String(name || 'client')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'client';
}

/** Provision cb_tenants + owner membership when a client pays or accepts invite. */
export async function provisionPlatformTenant({
  businessName,
  slug: slugInput,
  tier = 'signature',
  userId,
  contactEmail,
}) {
  const slug = slugify(slugInput || businessName);
  const name = String(businessName || slug).trim() || 'Client Site';

  const { rows: existing } = await query('SELECT id FROM cb_tenants WHERE slug = $1', [slug]);
  let tenantId = existing[0]?.id;

  if (!tenantId) {
    tenantId = cuid();
    await query(
      `INSERT INTO cb_tenants (id, slug, name, tier, timezone, currency, contact_email, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'America/Chicago', 'USD', $5, NOW(), NOW())`,
      [tenantId, slug, name, tier, contactEmail || null],
    );
  } else {
    await query(
      `UPDATE cb_tenants SET name = $1, tier = $2, contact_email = COALESCE($3, contact_email), updated_at = NOW() WHERE id = $4`,
      [name, tier, contactEmail || null, tenantId],
    );
  }

  const { rows: mem } = await query(
    'SELECT id FROM cb_memberships WHERE tenant_id = $1 AND user_id = $2',
    [tenantId, userId],
  );
  if (!mem[0]) {
    await query(
      `INSERT INTO cb_memberships (id, tenant_id, user_id, role, created_at) VALUES ($1, $2, $3, 'owner', NOW())`,
      [cuid(), tenantId, userId],
    );
  }

  return { tenantId, slug };
}

/** Simulated client invite for pipeline stress-tests (no Stripe). */
export async function sendSimClientInvite({ email, name, businessName, slug, tier = 'signature' }) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) throw new Error('email required');

  let user;
  const { rows: existing } = await query('SELECT id, email, name FROM users WHERE email = $1', [normalized]);
  if (existing[0]) {
    user = existing[0];
  } else {
    const { hashPassword, normalizeUsername } = await import('../auth.js');
    let username = normalizeUsername(normalized.split('@')[0]) || `client${Date.now().toString(36)}`;
    const { rows: taken } = await query('SELECT 1 FROM users WHERE LOWER(username) = $1', [username]);
    if (taken[0]) username = `${username.slice(0, 20)}${Math.random().toString(36).slice(2, 5)}`;
    const placeholder = await hashPassword(crypto.randomBytes(24).toString('hex'));
    const { rows: created } = await query(
      `INSERT INTO users (email, username, name, password_hash, role)
       VALUES ($1, $2, $3, $4, 'user') RETURNING id, email, name`,
      [normalized, username, name || businessName || normalized.split('@')[0], placeholder],
    );
    user = created[0];
  }

  const tenant = await provisionPlatformTenant({
    businessName: businessName || 'Legacy Tables',
    slug: slug || 'legacy',
    tier,
    userId: user.id,
    contactEmail: normalized,
  });

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt],
  );

  const { URLS } = await import('./urls.js');
  const onboardingUrl = `${(URLS.app || 'https://app.creativebuilds.dev').replace(/\/$/, '')}/onboarding?token=${rawToken}`;

  return { user, tenant, onboardingUrl, devToken: rawToken };
}
