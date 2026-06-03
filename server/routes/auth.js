import { Router } from 'express';
import crypto from 'node:crypto';
import { query } from '../db.js';
import {
  findUserByEmail,
  findUserById,
  hashPassword,
  verifyPassword,
  signToken,
  userPayload,
  requireAuth,
} from '../auth.js';
import {
  syncUserToOdysseus,
  setCbdevTokenCookie,
  clearCbdevTokenCookie,
  readCbdevToken,
} from '../lib/odysseusAuth.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const name = String(req.body.name || '').trim();
    const password = String(req.body.password || '');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Valid email required' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }
    if (!name) {
      res.status(400).json({ error: 'Name required' });
      return;
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const { rows } = await query(
      `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)
       RETURNING id, email, name, password_hash, role, created_at`,
      [email, name, passwordHash],
    );
    const user = userPayload(rows[0]);
    const token = signToken(rows[0]);
    setCbdevTokenCookie(res, token);
    await syncUserToOdysseus(rows[0]);
    res.status(201).json({ user, token });
  } catch (err) {
    console.error('auth register:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    const row = await findUserByEmail(email);
    if (!row || !(await verifyPassword(password, row.password_hash))) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const user = userPayload(row);
    const token = signToken(row);
    setCbdevTokenCookie(res, token);
    await syncUserToOdysseus(row);
    res.json({ user, token });
  } catch (err) {
    console.error('auth login:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const row = await findUserById(req.userId);
    if (!row) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user: userPayload(row) });
  } catch (err) {
    console.error('auth me:', err);
    res.status(500).json({ error: 'Failed to load user' });
  }
});

router.post('/logout', (_req, res) => {
  clearCbdevTokenCookie(res);
  res.json({ ok: true });
});

router.post('/session-cookie', async (req, res) => {
  const token = readCbdevToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  setCbdevTokenCookie(res, token);
  res.json({ ok: true });
});

router.post('/reset/request', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) {
      res.status(400).json({ error: 'Email required' });
      return;
    }

    const user = await findUserByEmail(email);
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await query(
        `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
        [user.id, tokenHash, expiresAt],
      );
      console.log(`cbdev-server: password reset token for ${email}: ${rawToken}`);
      if (process.env.NODE_ENV !== 'production') {
        res.json({
          ok: true,
          message: 'If an account exists, a reset link is on its way.',
          devToken: rawToken,
        });
        return;
      }
    }

    res.json({ ok: true, message: 'If an account exists, a reset link is on its way.' });
  } catch (err) {
    console.error('auth reset request:', err);
    res.status(500).json({ error: 'Reset request failed' });
  }
});

router.post('/reset/confirm', async (req, res) => {
  try {
    const token = String(req.body.token || '').trim();
    const password = String(req.body.password || '');

    if (!token) {
      res.status(400).json({ error: 'Reset token required' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { rows } = await query(
      `SELECT pr.id, pr.user_id FROM password_resets pr
       WHERE pr.token_hash = $1 AND pr.used_at IS NULL AND pr.expires_at > NOW()
       ORDER BY pr.created_at DESC LIMIT 1`,
      [tokenHash],
    );
    const reset = rows[0];
    if (!reset) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    const passwordHash = await hashPassword(password);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, reset.user_id]);
    await query('UPDATE password_resets SET used_at = NOW() WHERE id = $1', [reset.id]);

    const { rows: userRows } = await query(
      'SELECT id, email, name, password_hash, role, created_at FROM users WHERE id = $1',
      [reset.user_id],
    );
    if (userRows[0]) await syncUserToOdysseus(userRows[0]);

    res.json({ ok: true, message: 'Password updated. You can sign in now.' });
  } catch (err) {
    console.error('auth reset confirm:', err);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

export default router;
