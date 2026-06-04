import http from 'node:http';

const TARGET = process.env.ODYSSEUS_URL || 'http://127.0.0.1:7000';
const CHAT_PREFIX = '/chat';
const STATIC_PREFIX = `${CHAT_PREFIX}/st`;

function rewriteCss(css) {
  return css
    .replace(/url\(\s*(["']?)\/(?!chat\/)(static)\//g, `url($1${STATIC_PREFIX}/`)
    .replace(/url\(\s*(["']?)\/chat\/(?:static|s)\//g, `url($1${STATIC_PREFIX}/`);
}

function collectBody(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/** Passthrough /chat/st/* → Odysseus /static/* (never body-rewritten except CSS url paths). */
export function createOdysseusStaticRoute() {
  const target = new URL(TARGET);

  return (req, res) => {
    const upstreamPath = `/static${req.url || '/'}`;
    const proxyReq = http.request(
      {
        hostname: target.hostname,
        port: target.port || 80,
        path: upstreamPath,
        method: req.method,
        headers: { ...req.headers, host: target.host },
      },
      async (proxyRes) => {
        const headers = { ...proxyRes.headers };
        delete headers.etag;

        const path = req.url || '/';
        const isCss = (headers['content-type'] || '').split(';')[0].trim().toLowerCase() === 'text/css';
        const isJs = /\.m?js(?:\?|$)/i.test(path);

        headers['cache-control'] = isJs
          ? 'private, no-cache, must-revalidate'
          : 'public, max-age=86400';

        if (isCss) {
          try {
            const body = await collectBody(proxyRes);
            const rewritten = rewriteCss(body.toString('utf8'));
            headers['content-length'] = String(Buffer.byteLength(rewritten, 'utf8'));
            res.writeHead(proxyRes.statusCode || 200, headers);
            res.end(rewritten);
            return;
          } catch (err) {
            console.error('odysseus-static css:', err.message);
          }
        }

        res.writeHead(proxyRes.statusCode || 200, headers);
        proxyRes.pipe(res);
      },
    );

    proxyReq.on('error', (err) => {
      console.error('odysseus-static:', err.message);
      if (!res.headersSent) res.status(502).type('text/plain').send('Static unavailable');
    });

    req.pipe(proxyReq);
  };
}
