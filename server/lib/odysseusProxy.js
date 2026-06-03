import http from 'node:http';
import { findUserByUsername, signToken } from '../auth.js';
import { setCbdevTokenCookie } from './odysseusAuth.js';

const CHAT_PREFIX = '/chat';
const TARGET = process.env.ODYSSEUS_URL || 'http://127.0.0.1:7000';

const INJECT_SCRIPT = `<script>(function(){var P='${CHAT_PREFIX}';function rw(u){if(typeof u!=='string')return u;if(u.startsWith(P+'/')||u===P)return u;try{var o=new URL(u,location.origin);if(o.origin===location.origin&&o.pathname.startsWith('/')&&!o.pathname.startsWith(P)){o.pathname=P+o.pathname;return o.toString();}}catch(e){}if(u.startsWith('/')&&!u.startsWith(P))return P+u;return u;}var f=window.fetch;window.fetch=function(i,n){if(typeof i==='string')i=rw(i);else if(i&&i.url)i=new Request(rw(i.url),i);return f.call(this,i,n);};var ES=window.EventSource;window.EventSource=function(u,o){return new ES(rw(u),o);};var op=window.open;window.open=function(u,t,f){if(typeof u==='string')u=rw(u);return op.call(window,u,t,f);};try{var LP=Location.prototype,A=LP.assign,R=LP.replace;LP.assign=function(u){return A.call(this,rw(u));};LP.replace=function(u){return R.call(this,rw(u));};var hd=Object.getOwnPropertyDescriptor(LP,'href');if(hd&&hd.set){var gs=hd.get,ss=hd.set;Object.defineProperty(LP,'href',{get:gs,set:function(v){ss.call(this,rw(v));},configurable:true,enumerable:true});}}catch(e){}})();</script>`;

const REWRITE_TYPES = new Set([
  'text/html',
  'text/css',
  'application/javascript',
  'text/javascript',
  'application/json',
]);

function rewriteBody(body, contentType) {
  if (!body?.length || !contentType) return body;
  const baseType = contentType.split(';')[0].trim().toLowerCase();
  if (!REWRITE_TYPES.has(baseType)) return body;

  let text = body.toString('utf8');
  if (baseType === 'text/html') {
    text = text.includes('<head>')
      ? text.replace('<head>', `<head>${INJECT_SCRIPT}`)
      : INJECT_SCRIPT + text;
  }

  text = text
    .replace(/="\/(?!chat\/)/g, `="${CHAT_PREFIX}/`)
    .replace(/='\/(?!chat\/)/g, `='${CHAT_PREFIX}/`)
    .replace(/\(\/(?!chat\/)/g, `(${CHAT_PREFIX}/`)
    .replace(/url\(\/(?!chat\/)/g, `url(${CHAT_PREFIX}/`);

  return Buffer.from(text, 'utf8');
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
            res.writeHead(proxyRes.statusCode || 200, outHeaders);
            proxyRes.pipe(res);
            return;
          }

          const body = await collectBody(proxyRes);
          const rewritten = rewriteBody(body, contentType);
          if (rewritten !== body) {
            outHeaders['content-length'] = String(rewritten.length);
          }

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
                if (row) setCbdevTokenCookie(res, signToken(row));
              }
            } catch {
              // ignore malformed login responses
            }
          }

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
