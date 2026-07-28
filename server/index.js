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
import storeRoutes from './routes/store.js';
import ordersRoutes from './routes/orders.js';
import inquiryRoutes from './routes/inquiry.js';
import freeAuditRoutes from './routes/free-audit.js';
import eventsRoutes from './routes/events.js';
import stripeRoutes from './routes/stripe.js';
import quotesRoutes from './routes/quotes.js';
import adminRoutes from './routes/admin.js';
import calWebhookRoutes from './routes/webhooks-cal.js';
import chatRoutes from './routes/chat.js';
import retellRoutes from './routes/retell.js';
import { pool } from './db.js';
import { ensureUploadDirs } from './lib/uploads.js';
import { ensureLeadAutomationSchema } from './lib/ensureSchema.js';
import { createOdysseusProxy, CHAT_PREFIX, STATIC_PREFIX } from './lib/odysseusProxy.js';
import { createOdysseusStaticRoute } from './lib/odysseusStatic.js';
import { ensureOdysseusSession } from './lib/odysseusAuth.js';
import { isAdminHost, isStudioHost } from './lib/urls.js';
import seoRoutes from './routes/seo.js';

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

// Host routing: admin → admin SPA; studio/apex → phone shell (see lib/urls.js)

const CORS_ORIGINS = new Set([
  'https://www.creativebuilds.dev',
  'https://test.creativebuilds.dev',
  'https://studio.creativebuilds.dev',
  'https://app.creativebuilds.dev',
  'https://creativebuilds.dev',
  'http://127.0.0.1:3011',
  'http://localhost:3011',
  'http://127.0.0.1:3004',
  'http://localhost:3004',
  'http://127.0.0.1:3012',
  'http://localhost:3012',
  'http://127.0.0.1:3001',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
]);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && CORS_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS' && origin && CORS_ORIGINS.has(origin)) {
    res.status(204).end();
    return;
  }
  next();
});

const jsonParser = express.json({ limit: '2mb' });
const rawParser = express.raw({ type: 'application/json', limit: '2mb' });
app.use((req, res, next) => {
  if (req.path === CHAT_PREFIX || req.path.startsWith(`${CHAT_PREFIX}/`)) {
    return next();
  }
  if (req.path === '/api/stripe/webhook') {
    return rawParser(req, res, next);
  }
  jsonParser(req, res, next);
});
app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      ok: true,
      admin: isAdminHost(_req),
      studio: isStudioHost(_req),
      host: (_req.headers.host || '').split(':')[0],
    });
  } catch (err) {
    console.error('health check failed:', err);
    res.status(503).json({ ok: false, error: 'Database unavailable' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/seo', seoRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/inquiry', inquiryRoutes);
app.use('/api/free-audit', freeAuditRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhooks/cal', calWebhookRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/retell', retellRoutes);

const odyBridgeScript = readFileSync(resolve(__dirname, 'lib/ody-bridge.js'), 'utf8');
app.get(`${CHAT_PREFIX}/ody-bridge.js`, (_req, res) => {
  res.type('application/javascript').set('Cache-Control', 'public, max-age=3600').send(odyBridgeScript);
});

app.use(`${STATIC_PREFIX}`, createOdysseusStaticRoute());
app.use(`${CHAT_PREFIX}/s`, createOdysseusStaticRoute());

// Odysseus AI workspace — proxied at studio.creativebuilds.dev/chat (and legacy apex)
app.use(CHAT_PREFIX, async (req, res) => {
  try {
    await ensureOdysseusSession(req, res);
  } catch (err) {
    console.error('odysseus-sso:', err.message);
  }
  createOdysseusProxy()(req, res);
});

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
    if (!isStudioHost(req) && !req.path.startsWith('/api')) return next();
    express.static(distDir, { index: false })(req, res, next);
  });
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    if (req.path === CHAT_PREFIX || req.path.startsWith(`${CHAT_PREFIX}/`)) return next();
    if (isAdminHost(req)) {
      if (existsSync(adminDist)) {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(resolve(adminDist, 'index.html'));
        return;
      }
      return next();
    }
    if (!isStudioHost(req)) {
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
    await ensureLeadAutomationSchema();
  } catch (err) {
    console.error('lead automation schema:', err.message);
  }
});
