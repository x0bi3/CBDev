import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
const JWT_EXPIRES = '7d';

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, username: user.username || null, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES },
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function userPayload(row) {
  return {
    id: row.id,
    email: row.email,
    username: row.username || null,
    name: row.name,
    role: row.role,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

const USER_COLS = 'id, email, username, name, password_hash, role, created_at';

export function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 32);
}

export function isValidUsername(username) {
  return /^[a-z0-9_]{1,32}$/.test(username);
}

export async function findUserByEmail(email) {
  const { rows } = await query(
    `SELECT ${USER_COLS} FROM users WHERE email = $1`,
    [email.toLowerCase().trim()],
  );
  return rows[0] || null;
}

export async function findUserByUsername(username) {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;
  const { rows } = await query(
    `SELECT ${USER_COLS} FROM users WHERE LOWER(username) = $1`,
    [normalized],
  );
  return rows[0] || null;
}

export async function findUserByLogin(login) {
  const value = String(login || '').trim();
  if (!value) return null;
  if (value.includes('@')) return findUserByEmail(value.toLowerCase());
  return findUserByUsername(value);
}

export async function findUserById(id) {
  const { rows } = await query(
    'SELECT id, email, username, name, role, created_at FROM users WHERE id = $1',
    [id],
  );
  return rows[0] || null;
}

function readSessionToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    if (trimmed.slice(0, eq).trim() === 'cbdev_token') {
      return decodeURIComponent(trimmed.slice(eq + 1).trim());
    }
  }
  return null;
}

function attachUserFromToken(req) {
  const token = readSessionToken(req);
  if (!token) return false;
  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    req.userEmail = payload.email;
    req.userRole = payload.role;
    return true;
  } catch {
    return false;
  }
}

export function optionalAuth(req, res, next) {
  attachUserFromToken(req);
  next();
}

export function requireAuth(req, res, next) {
  if (!attachUserFromToken(req)) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!attachUserFromToken(req)) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (req.userRole !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
