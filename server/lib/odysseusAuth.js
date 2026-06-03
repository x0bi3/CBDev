import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyToken, normalizeUsername } from '../auth.js';
import { query } from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ODYSSEUS_ROOT = process.env.ODYSSEUS_ROOT || '/home/pi/Desktop/Odysseus';
const SSO_SCRIPT = resolve(ODYSSEUS_ROOT, 'scripts/cbdev_sso.py');
const PYTHON = process.env.ODYSSEUS_PYTHON || resolve(ODYSSEUS_ROOT, 'venv/bin/python');

const SESSION_COOKIE = 'odysseus_session';
const CB_TOKEN_COOKIE = 'cbdev_token';
const TOKEN_TTL_SEC = 60 * 60 * 24 * 7;
const RESERVED_USERNAMES = new Set(['internal-tool', 'api', 'demo', 'system']);

export function emailToOdysseusUsername(email) {
  const normalized = String(email || '').trim().toLowerCase();
  let local = normalized.split('@')[0]
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 32);
  if (!local || RESERVED_USERNAMES.has(local)) {
    local = normalized
      .replace('@', '_at_')
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 32);
  }
  return local || 'user';
}

export function parseCookies(req) {
  const raw = req.headers.cookie || '';
  const out = {};
  for (const part of raw.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    out[key] = decodeURIComponent(val);
  }
  return out;
}

export function readCbdevToken(req) {
  const cookies = parseCookies(req);
  if (cookies[CB_TOKEN_COOKIE]) return cookies[CB_TOKEN_COOKIE];
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

function cookieParts(name, value, maxAge) {
  const secure = process.env.NODE_ENV === 'production';
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function formatCbdevTokenCookie(token) {
  return cookieParts(CB_TOKEN_COOKIE, token, TOKEN_TTL_SEC);
}

export function formatOdysseusSessionCookie(token) {
  return cookieParts(SESSION_COOKIE, token, TOKEN_TTL_SEC);
}

export function setCbdevTokenCookie(res, token) {
  res.append('Set-Cookie', formatCbdevTokenCookie(token));
}

export function clearCbdevTokenCookie(res) {
  const secure = process.env.NODE_ENV === 'production';
  const parts = [
    `${CB_TOKEN_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (secure) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

function setOdysseusSessionCookie(res, token) {
  res.append('Set-Cookie', formatOdysseusSessionCookie(token));
}

function runOdysseusSso(payload) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(PYTHON, [SSO_SCRIPT], {
      cwd: ODYSSEUS_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        DATABASE_URL: 'sqlite:///./data/app.db',
      },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `cbdev_sso exited ${code}`));
        return;
      }
      try {
        resolvePromise(JSON.parse(stdout.trim() || '{}'));
      } catch (err) {
        reject(new Error(`cbdev_sso invalid JSON: ${stdout}`));
      }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

export function odysseusUsernameForUser(userRow) {
  const explicit = normalizeUsername(userRow?.username);
  if (explicit) return explicit;
  return emailToOdysseusUsername(userRow?.email);
}

export async function syncUserToOdysseus(userRow) {
  const username = odysseusUsernameForUser(userRow);
  const result = await runOdysseusSso({
    action: 'sync',
    username,
    password_hash: userRow.password_hash,
    is_admin: userRow.role === 'admin',
  });
  if (!result.ok) {
    console.error('odysseus-sync: failed for', userRow.email);
  }
  return result.ok;
}

async function checkOdysseusSession(token, expectedUsername) {
  const result = await runOdysseusSso({ action: 'check', token });
  return result.ok && result.username === expectedUsername;
}

async function createOdysseusSession(username) {
  const result = await runOdysseusSso({ action: 'session', username });
  return result.ok ? result.token : null;
}

async function findUserWithHash(userId) {
  const { rows } = await query(
    'SELECT id, email, username, name, password_hash, role FROM users WHERE id = $1',
    [userId],
  );
  return rows[0] || null;
}

export async function ensureOdysseusSession(req, res) {
  const cbToken = readCbdevToken(req);
  if (!cbToken) return false;

  let payload;
  try {
    payload = verifyToken(cbToken);
  } catch {
    return false;
  }

  const user = await findUserWithHash(payload.sub);
  if (!user) return false;

  const username = odysseusUsernameForUser(user);
  const cookies = parseCookies(req);
  const existing = cookies[SESSION_COOKIE];

  if (existing && await checkOdysseusSession(existing, username)) {
    return true;
  }

  await syncUserToOdysseus(user);
  const sessionToken = await createOdysseusSession(username);
  if (!sessionToken) return false;

  setOdysseusSessionCookie(res, sessionToken);
  req.headers.cookie = [
    req.headers.cookie,
    `${SESSION_COOKIE}=${sessionToken}`,
  ].filter(Boolean).join('; ');
  return true;
}
