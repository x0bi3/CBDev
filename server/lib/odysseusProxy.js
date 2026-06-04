import http from 'node:http';
import { findUserByUsername, signToken } from '../auth.js';
import { formatCbdevTokenCookie } from './odysseusAuth.js';

const CHAT_PREFIX = '/chat';
const TARGET = process.env.ODYSSEUS_URL || 'http://127.0.0.1:7000';

const REWRITE_TYPES = new Set([
  'text/html',
  'text/css',
  'application/javascript',
  'text/javascript',
  'application/json',
]);

function rewritePaths(text) {
  const P = CHAT_PREFIX;

  // Odysseus builds API URLs from window.location.origin (misses /chat prefix)
  text = text.replace(
    /const (API(?:_BASE)?) = window\.location\.origin;/g,
    `const $1 = window.location.origin + '${P}';`,
  );
  text = text.replace(
    /\$\{window\.location\.origin\}\/api\//g,
    `\${window.location.origin}${P}/api/`,
  );
  text = text.replace(
    /window\.location\.origin \+ (['"])\/api\//g,
    `window.location.origin + $1${P}/api/`,
  );

  // Template literals: `/api/...`, `/static/...`
  text = text.replace(/`\/(api|static)\//g, (_, root) => '`' + P + '/' + root + '/');

  // Quoted app paths — only /api and /static (never blanket quote+slash)
  text = text.replace(/(['"])\/(api|static)(?=\/|['"])/g, `$1${P}/$2`);

  // SPA deep-link routes
  text = text.replace(
    /(['"])\/(notes|calendar|cookbook|email|memory|gallery|tasks|library|login|backgrounds)(?=['"/?#]|$)/g,
    `$1${P}/$2`,
  );

  // HTML attributes
  text = text
    .replace(/(\s(?:href|src|action)\s*=\s*["'])\/(?!chat\/)(api|static)\//gi, `$1${P}/$2/`)
    .replace(
      /(\s(?:href|src|action)\s*=\s*["'])\/(?!chat\/)(?:notes|calendar|cookbook|email|memory|gallery|tasks|library|login|backgrounds)\b/gi,
      `$1${P}/$2`,
    );

  // fetch/import/EventSource/WebSocket calls
  text = text
    .replace(/(\bfetch\s*\(\s*['"])\/(?!chat\/)/g, `$1${P}/`)
    .replace(/(\bimport\s*\(\s*['"])\/(?!chat\/)/g, `$1${P}/`)
    .replace(/(\bnew\s+EventSource\s*\(\s*['"])\/(?!chat\/)/g, `$1${P}/`)
    .replace(/(\bnew\s+WebSocket\s*\(\s*['"])\/(?!chat\/)/g, `$1${P}/`);

  // CSS url(/static/...)
  text = text.replace(/url\(\s*(["']?)\/(?!chat\/)(api|static)\//g, `url($1${P}/$2/`);

  // Attribute fallbacks for paths without api/static prefix
  text = text
    .replace(/="\/(?!chat\/)(api|static)\//g, `="${P}/$1/`)
    .replace(/='\/(?!chat\/)(api|static)\//g, `='${P}/$1/`);

  text = text.replace(
    /window\.location\.(replace|assign)\s*\(\s*['"]\/?['"]\s*\)/gi,
    `window.location.$1('${P}/')`,
  );

  return text;
}

function rewriteBody(body, contentType) {
  if (!body?.length || !contentType) return body;
  const baseType = contentType.split(';')[0].trim().toLowerCase();
  if (!REWRITE_TYPES.has(baseType)) return body;

  const text = rewritePaths(body.toString('utf8'));
  return Buffer.from(text, 'utf8');
}

function normalizeSetCookies(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function mergeSetCookies(outHeaders, res, extra = []) {
  const merged = [
    ...normalizeSetCookies(outHeaders['set-cookie']),
    ...normalizeSetCookies(res.getHeader('Set-Cookie')),
    ...extra,
  ];
  delete outHeaders['set-cookie'];
  if (merged.length) outHeaders['set-cookie'] = merged;
}

function rewriteLocation(value) {
  if (!value || typeof value !== 'string') return value;
  if (value.startsWith(CHAT_PREFIX)) return value;
  if (value.startsWith('/')) return `${CHAT_PREFIX}${value}`;
  try {
    const url = new URL(value);
    if (url.pathname.startsWith('/') && !url.pathname.startsWith(CHAT_PREFIX)) {
      url.pathname = `${CHAT_PREFIX}${url.pathname}`;
      return url.toString();
    }
  } catch {
    // leave absolute/external URLs unchanged
  }
  return value;
}

function collectBody(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export function createOdysseusProxy() {
  const target = new URL(TARGET);

  return (req, res) => {
    const upstreamPath = req.url && req.url.startsWith('/') ? req.url : '/';
    const headers = { ...req.headers, host: target.host };

    const proxyReq = http.request(
      {
        hostname: target.hostname,
        port: target.port || 80,
        path: upstreamPath,
        method: req.method,
        headers,
      },
      async (proxyRes) => {
        try {
          const outHeaders = { ...proxyRes.headers };
          if (outHeaders.location) {
            outHeaders.location = rewriteLocation(outHeaders.location);
          }

          const contentType = outHeaders['content-type'] || '';
          const isEventStream = contentType.includes('text/event-stream');

          if (isEventStream) {
            delete outHeaders['content-length'];
            mergeSetCookies(outHeaders, res);
            res.writeHead(proxyRes.statusCode || 200, outHeaders);
            proxyRes.pipe(res);
            return;
          }

          const body = await collectBody(proxyRes);
          const rewritten = rewriteBody(body, contentType);
          if (rewritten !== body) {
            outHeaders['content-length'] = String(rewritten.length);
          }

          const extraCookies = [];
          // Odysseus login at /chat → also issue CreativeBuilds session cookie
          if (
            req.method === 'POST'
            && upstreamPath.startsWith('/api/auth/login')
            && proxyRes.statusCode === 200
          ) {
            try {
              const data = JSON.parse(body.toString('utf8'));
              if (data.ok && data.username) {
                const row = await findUserByUsername(data.username);
                if (row) extraCookies.push(formatCbdevTokenCookie(signToken(row)));
              }
            } catch {
              // ignore malformed login responses
            }
          }

          mergeSetCookies(outHeaders, res, extraCookies);
          res.writeHead(proxyRes.statusCode || 200, outHeaders);
          res.end(rewritten);
        } catch (err) {
          console.error('odysseus-proxy:', err.message);
          if (!res.headersSent) {
            res.status(502).type('text/plain').send('Odysseus proxy error');
          }
        }
      },
    );

    proxyReq.on('error', (err) => {
      console.error('odysseus-proxy:', err.message);
      if (!res.headersSent) {
        res.status(502).type('text/plain').send('Odysseus is unavailable. Check the service on the Pi.');
      }
    });

    req.pipe(proxyReq);
  };
}

export { CHAT_PREFIX };
