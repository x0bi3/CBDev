import express from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import authRoutes from './routes/auth.js';
import productsRoutes from './routes/products.js';
import portfolioRoutes from './routes/portfolio.js';
import blogRoutes from './routes/blog.js';
import ticketsRoutes from './routes/tickets.js';
import calendarRoutes from './routes/calendar.js';
import homeRoutes from './routes/home.js';
import adminRoutes from './routes/admin.js';
import { pool } from './db.js';
import { ensureUploadDirs } from './lib/uploads.js';
import { startBlogIdeasScheduler } from './lib/blogIdeasScheduler.js';
import { migrateBlogBodyToHtml } from './lib/blogMigrate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const distDir = resolve(root, 'dist');
const adminDist = resolve(distDir, 'admin');
const uploadsDir = resolve(root, 'uploads');
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
ensureUploadDirs();

const app = express();
const PORT = Number(process.env.PORT) || 3020;

function isAdminHost(req) {
  const host = (req.headers.host || '').split(':')[0].toLowerCase();
  return host === 'creativeadmin.cyberopticsoftware.com';
}

app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, admin: isAdminHost(_req) });
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
app.use('/api/calendar', calendarRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/admin', adminRoutes);

if (existsSync(adminDist)) {
  app.use((req, res, next) => {
    if (!isAdminHost(req)) return next();
    if (req.path.startsWith('/api')) return next();

    // Vite emits shared chunks under dist/assets/, not dist/admin/
    if (req.path.startsWith('/assets/') && existsSync(distDir)) {
      express.static(distDir, {
        index: false,
        maxAge: '1y',
        immutable: true,
      })(req, res, () => {
        // Never SPA-fallback for missing assets — avoids text/html MIME on .js/.css
        res.status(404).type('text/plain').send('Not found');
      });
      return;
    }

    express.static(adminDist, { index: false })(req, res, (err) => {
      if (err) return next(err);
      if (req.method !== 'GET') return next();
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(resolve(adminDist, 'index.html'));
    });
  });
}

if (existsSync(distDir)) {
  app.use((req, res, next) => {
    if (isAdminHost(req) && !req.path.startsWith('/api')) return next();
    express.static(distDir, { index: false })(req, res, next);
  });
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    if (isAdminHost(req)) {
      if (existsSync(adminDist)) {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(resolve(adminDist, 'index.html'));
        return;
      }
      return next();
    }
    res.sendFile(resolve(distDir, 'index.html'));
  });
} else {
  console.warn('cbdev-server: dist/ not found — API only until you run npm run build');
}

app.listen(PORT, async () => {
  console.log(`cbdev-server: listening on http://127.0.0.1:${PORT}`);
  try {
    await migrateBlogBodyToHtml();
  } catch (err) {
    console.error('blog body migration:', err.message);
  }
  startBlogIdeasScheduler();
});
