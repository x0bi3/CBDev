import express from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import authRoutes from './routes/auth.js';
import productsRoutes from './routes/products.js';
import portfolioRoutes from './routes/portfolio.js';
import blogRoutes from './routes/blog.js';
import ticketsRoutes from './routes/tickets.js';
import { pool } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const distDir = resolve(root, 'dist');
const envPath = resolve(root, '.env');

function loadEnv() {
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const app = express();
const PORT = Number(process.env.PORT) || 3020;

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (err) {
    console.error('health check failed:', err);
    res.status(503).json({ ok: false, error: 'Database unavailable' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/tickets', ticketsRoutes);

if (existsSync(distDir)) {
  app.use(express.static(distDir, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(resolve(distDir, 'index.html'));
  });
} else {
  console.warn('cbdev-server: dist/ not found — API only until you run npm run build');
}

app.listen(PORT, () => {
  console.log(`cbdev-server: listening on http://127.0.0.1:${PORT}`);
});
