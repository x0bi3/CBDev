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
    { sub: user.id, email: user.email, role: user.role },
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
    name: row.name,
    role: row.role,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

export async function findUserByEmail(email) {
  const { rows } = await query(
    'SELECT id, email, name, password_hash, role, created_at FROM users WHERE email = $1',
    [email.toLowerCase().trim()],
  );
  return rows[0] || null;
}

export async function findUserById(id) {
  const { rows } = await query(
    'SELECT id, email, name, role, created_at FROM users WHERE id = $1',
    [id],
  );
  return rows[0] || null;
}

function attachUserFromToken(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
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
