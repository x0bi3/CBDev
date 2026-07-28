/**
 * Free website audit collector + CB section normalizer.
 * Uses Google PageSpeed Insights (Lighthouse categories) plus HTML/header checks.
 * Optionally merges Sam toolkit audit_runner JSON when available.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';

const SECTION_IDS = [
  'performance',
  'seo',
  'accessibility',
  'security',
  'technical',
];

const SECTION_META = {
  performance: {
    id: 'performance',
    title: 'Performance & Mobile',
    blurb: 'How snappy the page feels on a phone, plus the Core Web Vitals that make that feel real.',
  },
  seo: {
    id: 'seo',
    title: 'SEO',
    blurb: 'Can search engines actually read and surface this page the way you hope?',
  },
  accessibility: {
    id: 'accessibility',
    title: 'Accessibility',
    blurb: 'Can real people (and assistive tech) use this without fighting the layout?',
  },
  security: {
    id: 'security',
    title: 'Security & Hygiene',
    blurb: 'HTTPS, headers, and the small locks that keep visitors from side-eyeing the padlock.',
  },
  technical: {
    id: 'technical',
    title: 'Technical / Best Practices',
    blurb: 'Under-the-hood hygiene: modern practices, crawl basics, and console red flags.',
  },
};

const SAM_TOOLKIT_CANDIDATES = [
  resolve(
    process.env.HOME || '',
    'Desktop/Projects/Personal Projects/Creative Builds Professional/agents/Sam/toolkit/scripts/audit_runner.py',
  ),
  resolve(process.env.HOME || '', '.cursor/skills/sam/toolkit/scripts/audit_runner.py'),
  process.env.SAM_AUDIT_RUNNER || '',
].filter(Boolean);

function scoreLabel(n) {
  if (n == null || Number.isNaN(n)) return 'n/a';
  if (n >= 90) return 'strong';
  if (n >= 50) return 'needs work';
  return 'critical';
}

function clampScore(n) {
  if (n == null || Number.isNaN(Number(n))) return null;
  return Math.max(0, Math.min(100, Math.round(Number(n))));
}

function fetchUrl(targetUrl, { method = 'GET', timeoutMs = 20000, maxRedirects = 5 } = {}) {
  return new Promise((resolvePromise, reject) => {
    let redirects = 0;
    const go = (urlStr) => {
      let parsed;
      try {
        parsed = new URL(urlStr);
      } catch (err) {
        reject(err);
        return;
      }
      const lib = parsed.protocol === 'http:' ? http : https;
      const req = lib.request(
        {
          protocol: parsed.protocol,
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
          path: `${parsed.pathname}${parsed.search}`,
          method,
          headers: {
            'User-Agent': 'CreativeBuilds-FreeAudit/1.0 (+https://www.creativebuilds.dev)',
            Accept: 'text/html,application/xhtml+xml,application/json,*/*',
          },
          timeout: timeoutMs,
          family: 4,
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            const loc = res.headers.location;
            if (res.statusCode >= 300 && res.statusCode < 400 && loc && redirects < maxRedirects) {
              redirects += 1;
              const next = new URL(loc, urlStr).toString();
              go(next);
              return;
            }
            resolvePromise({
              statusCode: res.statusCode,
              headers: res.headers,
              body,
              finalUrl: urlStr,
            });
          });
        },
      );
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout fetching ${urlStr}`));
      });
      req.on('error', reject);
      req.end();
    };
    go(targetUrl);
  });
}

async function runPageSpeed(url, strategy) {
  const key = process.env.PAGESPEED_API_KEY;
  const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  endpoint.searchParams.set('url', url);
  endpoint.searchParams.set('strategy', strategy);
  for (const cat of ['performance', 'accessibility', 'best-practices', 'seo']) {
    endpoint.searchParams.append('category', cat);
  }
  if (key) endpoint.searchParams.set('key', key);

  let lastErr;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      if (typeof fetch === 'function') {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 100000);
        try {
          const res = await fetch(endpoint.toString(), {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
          });
          clearTimeout(timer);
          if (!res.ok) {
            const body = await res.text();
            throw new Error(`PSI ${strategy} HTTP ${res.status}: ${body.slice(0, 180)}`);
          }
          return await res.json();
        } catch (err) {
          clearTimeout(timer);
          throw err;
        }
      }
      const res = await fetchUrl(endpoint.toString(), { timeoutMs: 100000 });
      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error(`PSI ${strategy} HTTP ${res.statusCode}: ${res.body.slice(0, 180)}`);
      }
      return JSON.parse(res.body);
    } catch (err) {
      lastErr = err;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr || new Error(`PSI ${strategy} failed`);
}

function psiCategoryScores(psi) {
  const cats = psi?.lighthouseResult?.categories || {};
  const score = (id) => {
    const s = cats[id]?.score;
    return s == null ? null : clampScore(s * 100);
  };
  return {
    performance: score('performance'),
    accessibility: score('accessibility'),
    bestPractices: score('best-practices'),
    seo: score('seo'),
  };
}

function psiAuditsList(psi, ids) {
  const audits = psi?.lighthouseResult?.audits || {};
  const out = [];
  for (const id of ids) {
    const a = audits[id];
    if (!a) continue;
    if (a.score === 1 || a.score == null) continue;
    out.push({
      id,
      title: a.title || id,
      description: (a.description || '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').slice(0, 280),
      displayValue: a.displayValue || null,
      score: a.score == null ? null : clampScore(a.score * 100),
    });
  }
  return out;
}

function analyzeHtmlAndHeaders(url, fetchResult) {
  const html = fetchResult.body || '';
  const headers = fetchResult.headers || {};
  const lower = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(', ') : String(v)]),
  );

  const issues = [];
  const tips = [];
  const findings = [];

  const isHttps = url.startsWith('https://');
  if (!isHttps) {
    issues.push({ severity: 'critical', text: 'Site is not served over HTTPS.' });
    tips.push('Move the site to HTTPS with a valid certificate and redirect all HTTP traffic.');
  } else {
    findings.push({ ok: true, text: 'HTTPS is enabled.' });
  }

  const headerChecks = [
    ['strict-transport-security', 'HSTS', 'Add Strict-Transport-Security so browsers keep using HTTPS.'],
    ['content-security-policy', 'Content-Security-Policy', 'Add a Content-Security-Policy to reduce XSS risk.'],
    ['x-content-type-options', 'X-Content-Type-Options', 'Set X-Content-Type-Options: nosniff.'],
    ['x-frame-options', 'X-Frame-Options', 'Set X-Frame-Options (or CSP frame-ancestors) to block clickjacking.'],
    ['referrer-policy', 'Referrer-Policy', 'Set a Referrer-Policy (e.g. strict-origin-when-cross-origin).'],
    ['permissions-policy', 'Permissions-Policy', 'Add a Permissions-Policy to lock down browser features you do not need.'],
  ];

  let headerScore = isHttps ? 40 : 0;
  for (const [key, label, tip] of headerChecks) {
    if (lower[key]) {
      headerScore += 10;
      findings.push({ ok: true, text: `${label} present.` });
    } else {
      issues.push({ severity: 'warn', text: `Missing ${label} header.` });
      tips.push(tip);
    }
  }
  headerScore = clampScore(Math.min(100, headerScore));

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  const metaDesc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)
    || [])[1] || '';
  const canonical = (html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)
    || [])[1] || '';
  const ogTitle = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i) || [])[1] || '';
  const robotsMeta = (html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i) || [])[1] || '';
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  const imgMissingAlt = (html.match(/<img\b(?![^>]*\balt=)[^>]*>/gi) || []).length;
  const hasJsonLd = /application\/ld\+json/i.test(html);

  const seoIssues = [];
  const seoTips = [];
  const seoFindings = [];
  let seoHtmlScore = 100;

  if (!title) {
    seoIssues.push({ severity: 'critical', text: 'Missing <title> tag.' });
    seoTips.push('Add a unique, descriptive title tag (roughly 50–60 characters) that names the business and offer.');
    seoHtmlScore -= 25;
  } else if (title.length < 10) {
    seoIssues.push({ severity: 'warn', text: `Title is very short: “${title}”.` });
    seoTips.push('Expand the title so it clearly states who you are and what you offer.');
    seoHtmlScore -= 10;
  } else {
    seoFindings.push({ ok: true, text: `Title present (${title.length} chars).` });
  }

  if (!metaDesc) {
    seoIssues.push({ severity: 'warn', text: 'Missing meta description.' });
    seoTips.push('Write a meta description that summarizes the page and includes a soft call to action.');
    seoHtmlScore -= 15;
  } else {
    seoFindings.push({ ok: true, text: `Meta description present (${metaDesc.length} chars).` });
  }

  if (!canonical) {
    seoIssues.push({ severity: 'info', text: 'No canonical link found.' });
    seoTips.push('Add a rel=canonical pointing at the preferred URL to avoid duplicate-content confusion.');
    seoHtmlScore -= 5;
  } else {
    seoFindings.push({ ok: true, text: 'Canonical link present.' });
  }

  if (!ogTitle) {
    seoIssues.push({ severity: 'info', text: 'Missing Open Graph title (social share preview).' });
    seoTips.push('Add og:title, og:description, and og:image so shares look intentional on social apps.');
    seoHtmlScore -= 5;
  }

  if (/noindex/i.test(robotsMeta)) {
    seoIssues.push({ severity: 'critical', text: `Robots meta includes noindex: ${robotsMeta}` });
    seoTips.push('Remove noindex if this page should appear in search results.');
    seoHtmlScore -= 30;
  }

  if (h1Count === 0) {
    seoIssues.push({ severity: 'warn', text: 'No H1 heading found.' });
    seoTips.push('Add one clear H1 that matches the primary topic of the page.');
    seoHtmlScore -= 10;
  } else if (h1Count > 1) {
    seoIssues.push({ severity: 'info', text: `Multiple H1s found (${h1Count}).` });
    seoTips.push('Prefer a single primary H1; demote extras to H2.');
    seoHtmlScore -= 5;
  } else {
    seoFindings.push({ ok: true, text: 'Single H1 present.' });
  }

  if (!hasJsonLd) {
    seoIssues.push({ severity: 'info', text: 'No JSON-LD structured data detected.' });
    seoTips.push('Add Organization / LocalBusiness (or relevant) JSON-LD so search engines understand the entity.');
    seoHtmlScore -= 5;
  } else {
    seoFindings.push({ ok: true, text: 'JSON-LD structured data detected.' });
  }

  const a11yIssues = [];
  const a11yTips = [];
  const a11yFindings = [];
  let a11yHtmlScore = 100;

  if (!hasViewport) {
    a11yIssues.push({ severity: 'critical', text: 'Missing viewport meta — mobile layout will be unreliable.' });
    a11yTips.push('Add <meta name="viewport" content="width=device-width, initial-scale=1">.');
    a11yHtmlScore -= 30;
  } else {
    a11yFindings.push({ ok: true, text: 'Viewport meta present.' });
  }

  if (imgMissingAlt > 0) {
    a11yIssues.push({ severity: 'warn', text: `About ${imgMissingAlt} image(s) appear to lack an alt attribute.` });
    a11yTips.push('Give every meaningful image a short alt text; use empty alt for purely decorative images.');
    a11yHtmlScore -= Math.min(25, imgMissingAlt * 3);
  }

  // robots.txt / sitemap probes
  let robotsOk = false;
  let sitemapOk = false;
  const origin = new URL(url).origin;

  return {
    headerScore,
    securityIssues: issues,
    securityTips: tips,
    securityFindings: findings,
    seoHtmlScore: clampScore(seoHtmlScore),
    seoIssues,
    seoTips,
    seoFindings,
    a11yHtmlScore: clampScore(a11yHtmlScore),
    a11yIssues,
    a11yFindings,
    a11yTips,
    meta: { title, metaDesc, canonical, hasViewport, h1Count, imgMissingAlt, hasJsonLd, robotsMeta },
    origin,
    robotsOk,
    sitemapOk,
  };
}

async function probeRobotsAndSitemap(origin) {
  const out = { robotsOk: false, sitemapOk: false, robotsIssues: [], robotsTips: [], robotsFindings: [] };
  try {
    const robots = await fetchUrl(`${origin}/robots.txt`, { timeoutMs: 10000 });
    if (robots.statusCode === 200 && robots.body && !/^\s*<!DOCTYPE/i.test(robots.body)) {
      out.robotsOk = true;
      out.robotsFindings.push({ ok: true, text: 'robots.txt is reachable.' });
      if (/Disallow:\s*\/\s*$/im.test(robots.body) && !/Allow:/i.test(robots.body)) {
        out.robotsIssues.push({ severity: 'critical', text: 'robots.txt appears to disallow the whole site.' });
        out.robotsTips.push('Open crawl access for public pages if you want to appear in search.');
      }
      if (/Sitemap:\s*(\S+)/i.test(robots.body)) {
        out.robotsFindings.push({ ok: true, text: 'Sitemap referenced in robots.txt.' });
      } else {
        out.robotsIssues.push({ severity: 'info', text: 'No Sitemap: line in robots.txt.' });
        out.robotsTips.push('Add a Sitemap: line pointing at your XML sitemap.');
      }
    } else {
      out.robotsIssues.push({ severity: 'warn', text: 'robots.txt missing or not plain text.' });
      out.robotsTips.push('Publish a simple robots.txt and point it at your sitemap.');
    }
  } catch {
    out.robotsIssues.push({ severity: 'warn', text: 'Could not fetch robots.txt.' });
    out.robotsTips.push('Ensure robots.txt responds quickly over HTTPS.');
  }

  for (const path of ['/sitemap.xml', '/sitemap_index.xml']) {
    try {
      const sm = await fetchUrl(`${origin}${path}`, { timeoutMs: 10000 });
      if (sm.statusCode === 200 && /<urlset|<sitemapindex/i.test(sm.body)) {
        out.sitemapOk = true;
        out.robotsFindings.push({ ok: true, text: `Sitemap found at ${path}.` });
        break;
      }
    } catch {
      /* try next */
    }
  }
  if (!out.sitemapOk) {
    out.robotsIssues.push({ severity: 'warn', text: 'No XML sitemap found at common paths.' });
    out.robotsTips.push('Generate and submit an XML sitemap covering your important public URLs.');
  }
  return out;
}

function runSamAuditRunner(url, timeoutMs = 110000) {
  const script = SAM_TOOLKIT_CANDIDATES.find((p) => p && existsSync(p));
  if (!script) return Promise.resolve(null);

  return new Promise((resolvePromise) => {
    const tmpJson = `/tmp/cb-free-audit-${Date.now()}.json`;
    const child = spawn(
      process.env.PYTHON_BIN || 'python3',
      [script, url, '--json', tmpJson, '--no-html', '--no-markdown'],
      {
        env: { ...process.env },
        cwd: resolve(script, '..'),
      },
    );
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolvePromise(null);
    }, timeoutMs);
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('close', async (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        console.warn('free-audit: Sam toolkit exited', code, stderr.slice(0, 300));
        resolvePromise(null);
        return;
      }
      try {
        const { readFileSync, unlinkSync } = await import('node:fs');
        const raw = readFileSync(tmpJson, 'utf8');
        try {
          unlinkSync(tmpJson);
        } catch {
          /* ignore */
        }
        resolvePromise(JSON.parse(raw));
      } catch (err) {
        console.warn('free-audit: failed reading Sam JSON', err.message);
        resolvePromise(null);
      }
    });
  });
}

function tipFromAudit(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('largest contentful paint') || t.includes('lcp')) {
    return 'Compress and properly size the hero image; preload the LCP image; cut render-blocking CSS/JS above the fold.';
  }
  if (t.includes('cumulative layout shift') || t.includes('cls')) {
    return 'Reserve space for images/embeds (width/height or aspect-ratio) and avoid late-loading fonts that shove content.';
  }
  if (t.includes('total blocking') || t.includes('tbt') || t.includes('interaction')) {
    return 'Split long JavaScript tasks, defer non-critical scripts, and trim third-party tags on first load.';
  }
  if (t.includes('image')) {
    return 'Serve modern formats (WebP/AVIF), lazy-load below-the-fold images, and size them to their display box.';
  }
  if (t.includes('contrast')) {
    return 'Raise text/background contrast to meet WCAG AA (especially muted gray on dark backgrounds).';
  }
  if (t.includes('button') || t.includes('name') || t.includes('label')) {
    return 'Give every control an accessible name (visible text or aria-label).';
  }
  if (t.includes('document title') || t.includes('meta description')) {
    return 'Write a unique title and meta description that match the page intent.';
  }
  if (t.includes('crawl') || t.includes('robots') || t.includes('http status')) {
    return 'Fix crawl blockers: status codes, robots rules, and canonical consistency.';
  }
  if (t.includes('https') || t.includes('security')) {
    return 'Enforce HTTPS redirects and add standard security headers on the origin or CDN.';
  }
  return `Address “${title}” with a focused fix, then re-test this URL on mobile.`;
}

const PAID_AUDIT_HREF = {
  performance: '/audit#deepsite-analysis',
  seo: '/audit#deepsite-analysis',
  accessibility: '/audit#deepsite-analysis',
  security: '/audit#deepsite-analysis',
  technical: '/audit#deepsite-analysis',
};

const LEVEL_UP_POOLS = {
  performance: [
    'Budget third-party scripts: cap tags on the homepage and load chat/analytics after interaction.',
    'Ship a responsive hero in AVIF/WebP with explicit width/height and a preload for the LCP image.',
    'Split below-the-fold JS into dynamic imports so first paint is not waiting on the whole app.',
    'Edge-cache HTML/CSS where safe and shrink TTFB on mobile networks.',
  ],
  seo: [
    'Add Organization / LocalBusiness JSON-LD with real NAP so search engines map the entity.',
    'Build one topical cluster: hub page + 3 supporting pages that internally link with clear anchors.',
    'Write unique titles/descriptions for every money page - no template leftovers.',
    'Publish an XML sitemap and submit it in Search Console; keep lastmod honest.',
  ],
  accessibility: [
    'Run a keyboard-only pass: focus order, skip link, and visible focus rings on every interactive control.',
    'Audit color pairs for WCAG AA - especially muted text on dark workshop backgrounds.',
    'Caption or transcript any video/audio; describe complex images beyond empty alt.',
    'Name icon-only buttons with aria-label so screen readers are not left guessing.',
  ],
  security: [
    'Tighten Content-Security-Policy to an allowlist and report-only mode before enforce.',
    'Turn on HSTS (and preload when ready) so browsers never fall back to plain HTTP.',
    'Lock cookies to Secure; HttpOnly; SameSite=Lax (or Strict) on session tokens.',
    'Add a short Permissions-Policy that disables unused camera/mic/geolocation.',
  ],
  technical: [
    'Publish llms.txt (or a clear AI crawl policy) so agentic search knows what to cite.',
    'Kill console errors and deprecation warnings - they often hide real UX bugs.',
    'Document the stack in one place (CMS, CDN, analytics) so future changes stay intentional.',
    'Add a lightweight health/status endpoint for uptime monitors.',
  ],
};

const PRAISE_POOLS = {
  performance: [
    (host) => `${host} is moving - lab scores say visitors are not stuck staring at a spinner.`,
    (host) => `Speed on ${host} already looks hireable. That is rare for a first free pass.`,
    (host) => `${host} clears the loud performance bars. The foundation is solid.`,
  ],
  seo: [
    (host) => `Search basics on ${host} are in good shape - titles, crawl signals, and structure are working.`,
    (host) => `${host} is speaking search's language. That is real craft, not luck.`,
    (host) => `SEO hygiene on ${host} looks intentional. Keep feeding it clear pages.`,
  ],
  accessibility: [
    (host) => `${host} respects assistive tech more than most sites we scan. That care shows.`,
    (host) => `Accessibility checks on ${host} came back strong - people can actually use this.`,
    (host) => `${host} clears the big a11y gates. Inclusive by design, not by accident.`,
  ],
  security: [
    (host) => `${host} is locked down where it counts. HTTPS and hygiene are not afterthoughts.`,
    (host) => `Security posture on ${host} looks deliberate - headers and transport are doing their job.`,
    (host) => `${host} is not leaving the easy doors open. That is the right default.`,
  ],
  technical: [
    (host) => `Technical hygiene on ${host} is clean - modern practices without the red console fireworks.`,
    (host) => `${host} looks well-kept under the hood. Best-practices scores agree.`,
    (host) => `The build behind ${host} is tidy. That is how you stay fast to change later.`,
  ],
};

function hashSeed(str) {
  let h = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function pickN(pool, n, seed) {
  if (!pool?.length) return [];
  const out = [];
  const used = new Set();
  let s = seed >>> 0;
  for (let i = 0; i < n && used.size < pool.length; i += 1) {
    s = (s * 1664525 + 1013904223) >>> 0;
    let idx = s % pool.length;
    let guard = 0;
    while (used.has(idx) && guard < pool.length) {
      idx = (idx + 1) % pool.length;
      guard += 1;
    }
    used.add(idx);
    out.push(pool[idx]);
  }
  return out;
}

function buildPraiseAndLevelUp(id, url, score) {
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return 'this site';
    }
  })();
  const seed = hashSeed(`${id}|${url}|${score}|${new Date().toISOString().slice(0, 10)}`);
  const praiseFns = PRAISE_POOLS[id] || PRAISE_POOLS.technical;
  const praise = praiseFns[seed % praiseFns.length](host);
  const count = 1 + (seed % 3); // 1–3
  const moves = pickN(LEVEL_UP_POOLS[id] || LEVEL_UP_POOLS.technical, count, seed);
  return { praise, moves };
}

function paidAuditHref(id, token) {
  const base = PAID_AUDIT_HREF[id] || '/audit';
  const q = `utm_source=free-audit&cta_section=${encodeURIComponent(id)}&report_token=${encodeURIComponent(token || '')}`;
  const join = base.includes('?') ? '&' : base.includes('#') ? '?' : '?';
  // Keep hash: /audit?utm...#seo-audit is awkward; put utm before hash
  if (base.includes('#')) {
    const [path, hash] = base.split('#');
    return `${path}?${q}#${hash}`;
  }
  return `${base}${join}${q}`;
}

function buildSection({ id, score, issues, findings, tips, url, reportToken }) {
  const meta = SECTION_META[id];
  let uniqueTips = [...new Set((tips || []).filter(Boolean))].slice(0, 3);
  const uniqueIssues = (issues || []).slice(0, 12);
  const uniqueFindings = (findings || []).slice(0, 10);
  const scored = clampScore(score);
  const isStrong = scored != null && scored >= 95;

  let praise = null;
  if (isStrong || uniqueIssues.length === 0) {
    const gen = buildPraiseAndLevelUp(id, url || '', scored ?? 100);
    if (isStrong) {
      praise = gen.praise;
      uniqueTips = gen.moves.slice(0, 3);
    } else if (!uniqueTips.length) {
      uniqueTips = gen.moves.slice(0, 2);
    } else {
      uniqueTips = uniqueTips.slice(0, 3);
    }
  } else {
    uniqueTips = uniqueTips.slice(0, 3);
  }

  const q = `utm_source=free-audit&cta_section=${encodeURIComponent(id)}&report_token=${encodeURIComponent(reportToken || '')}`;

  return {
    id,
    title: meta.title,
    blurb: meta.blurb,
    score: scored,
    scoreLabel: scoreLabel(scored),
    whatsWrong: isStrong ? [] : uniqueIssues,
    findings: uniqueFindings,
    praise: praise || null,
    howIdFix: uniqueTips.map((text) => ({ text })),
    isStrong,
    cta: {
      label: isStrong
        ? 'DeepSite Analysis keeps every lane from this free report, then runs a multi-page crawl with scored findings, effort tags, and (on Standard/Heavy) annotated screenshots. Or we can talk the findings through on a short call.'
        : 'DeepSite Analysis includes everything in this free report, then goes further: multi-page crawl, P0–P2 punch list with effort tags, and on higher tiers screenshots plus a peer matrix. Prefer a conversation first? Book a call.',
      moreTipsLabel: 'Want the full DeepSite Analysis?',
      buttonLabel: 'Get DeepSite Analysis',
      hrefPaidAudit: paidAuditHref(id, reportToken),
      hrefInquiry: `/inquiry?mode=website&${q}`,
      hrefBook: `/book?${q}`,
    },
  };
}

function average(nums) {
  const vals = nums.filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (!vals.length) return null;
  return clampScore(vals.reduce((a, b) => a + b, 0) / vals.length);
}

async function probeTls(origin) {
  const out = { issues: [], findings: [], tips: [] };
  try {
    const httpsUrl = origin.startsWith('https') ? origin : origin.replace(/^http:/, 'https:');
    const httpUrl = httpsUrl.replace(/^https:/, 'http:');
    const secure = await fetchUrl(httpsUrl, { method: 'HEAD', timeoutMs: 10000 });
    if (secure.statusCode >= 200 && secure.statusCode < 500) {
      out.findings.push({ ok: true, text: 'HTTPS responds successfully.' });
    }
    try {
      const plain = await fetchUrl(httpUrl, { method: 'HEAD', timeoutMs: 8000, maxRedirects: 0 });
      if (plain.statusCode >= 300 && plain.statusCode < 400) {
        out.findings.push({ ok: true, text: 'HTTP redirects (or challenges) instead of serving mixed content blindly.' });
      } else if (plain.finalUrl?.startsWith('https:')) {
        out.findings.push({ ok: true, text: 'HTTP upgrades to HTTPS.' });
      } else if (plain.statusCode === 200) {
        out.issues.push({ severity: 'warn', text: 'HTTP still serves content without forcing HTTPS.' });
        out.tips.push('Redirect all HTTP traffic to HTTPS at the edge or origin.');
      }
    } catch {
      out.findings.push({ ok: true, text: 'Plain HTTP did not serve a clean page (often good).' });
    }
  } catch (err) {
    out.issues.push({ severity: 'warn', text: `TLS/HTTPS probe inconclusive: ${err.message}` });
  }
  return out;
}

function runSamScript(scriptName, args, timeoutMs = 25000) {
  const scriptDir = SAM_TOOLKIT_CANDIDATES.map((p) => (p ? resolve(p, '..') : '')).find((d) => d && existsSync(resolve(d, scriptName)));
  if (!scriptDir) return Promise.resolve(null);
  const scriptPath = resolve(scriptDir, scriptName);
  return new Promise((resolvePromise) => {
    const child = spawn(process.env.PYTHON_BIN || 'python3', [scriptPath, ...args, '--json'], {
      env: { ...process.env },
      cwd: scriptDir,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolvePromise(null);
    }, timeoutMs);
    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolvePromise(null);
        return;
      }
      try {
        resolvePromise(JSON.parse(stdout));
      } catch {
        resolvePromise(null);
      }
    });
  });
}

export async function collectAndNormalize(url, { reportToken = '' } = {}) {
  const errors = [];
  let mobilePsi = null;
  let desktopPsi = null;
  let pageFetch = null;
  let htmlAnalysis = null;
  let robots = null;

  try {
    const psiSettled = await Promise.allSettled([
      runPageSpeed(url, 'mobile'),
      runPageSpeed(url, 'desktop'),
    ]);
    if (psiSettled[0].status === 'fulfilled') mobilePsi = psiSettled[0].value;
    else errors.push(`PSI mobile: ${psiSettled[0].reason?.message || psiSettled[0].reason}`);
    if (psiSettled[1].status === 'fulfilled') desktopPsi = psiSettled[1].value;
    else errors.push(`PSI desktop: ${psiSettled[1].reason?.message || psiSettled[1].reason}`);
  } catch (err) {
    errors.push(`PSI: ${err.message}`);
  }

  try {
    pageFetch = await fetchUrl(url, { timeoutMs: 20000 });
    htmlAnalysis = analyzeHtmlAndHeaders(url, pageFetch);
    robots = await probeRobotsAndSitemap(htmlAnalysis.origin);
  } catch (err) {
    errors.push(`Fetch/HTML: ${err.message}`);
  }

  let tls = { issues: [], findings: [], tips: [] };
  try {
    if (htmlAnalysis?.origin) tls = await probeTls(htmlAnalysis.origin);
  } catch (err) {
    errors.push(`TLS: ${err.message}`);
  }

  // Targeted Sam scripts (fast) + optional full runner enrichment
  const extra = {
    social: null,
    images: null,
    thirdParty: null,
    a11y: null,
    robotsDetail: null,
    llms: null,
    broken: null,
  };
  // Cap Sam enrichment — skip full audit_runner (too slow); targeted scripts only
  try {
    const settled = await Promise.allSettled([
      runSamScript('social_meta.py', [url], 18000),
      runSamScript('image_weight_audit.py', [url], 20000),
      runSamScript('third_party_script_audit.py', [url], 20000),
      runSamScript('a11y_seo_checker.py', [url], 20000),
      runSamScript('robots_checker.py', [url], 12000),
      runSamScript('llms_txt_checker.py', [url], 12000),
      runSamScript('broken_links.py', [url, '--workers', '3', '--timeout', '5'], 25000),
    ]);
    const vals = settled.map((s) => (s.status === 'fulfilled' ? s.value : null));
    [
      extra.social,
      extra.images,
      extra.thirdParty,
      extra.a11y,
      extra.robotsDetail,
      extra.llms,
      extra.broken,
    ] = vals;
  } catch (err) {
    errors.push(`Sam toolkit: ${err.message}`);
  }

  const mobileScores = mobilePsi ? psiCategoryScores(mobilePsi) : {};
  const desktopScores = desktopPsi ? psiCategoryScores(desktopPsi) : {};

  const perfAudits = mobilePsi
    ? psiAuditsList(mobilePsi, [
        'first-contentful-paint',
        'largest-contentful-paint',
        'total-blocking-time',
        'cumulative-layout-shift',
        'speed-index',
        'interactive',
        'server-response-time',
        'render-blocking-resources',
        'unused-javascript',
        'unused-css-rules',
        'uses-responsive-images',
        'offscreen-images',
        'modern-image-formats',
      ])
    : [];

  const seoAudits = mobilePsi
    ? psiAuditsList(mobilePsi, [
        'document-title',
        'meta-description',
        'http-status-code',
        'link-text',
        'crawlable-anchors',
        'is-crawlable',
        'robots-txt',
        'hreflang',
        'canonical',
        'structured-data',
      ])
    : [];

  const a11yAudits = mobilePsi
    ? psiAuditsList(mobilePsi, [
        'color-contrast',
        'image-alt',
        'button-name',
        'link-name',
        'label',
        'html-has-lang',
        'meta-viewport',
        'heading-order',
        'aria-allowed-attr',
        'aria-required-attr',
      ])
    : [];

  const bpAudits = mobilePsi
    ? psiAuditsList(mobilePsi, [
        'is-on-https',
        'errors-in-console',
        'geolocation-on-start',
        'notification-on-start',
        'doctype',
        'charset',
        'js-libraries',
        'deprecations',
        'third-party-cookies',
        'viewport',
      ])
    : [];

  const perfScoreRaw = average([mobileScores.performance, desktopScores.performance]);
  const seoScore = average([
    mobileScores.seo,
    htmlAnalysis?.seoHtmlScore,
    robots?.robotsOk ? 80 : 40,
    robots?.sitemapOk ? 90 : 50,
  ]);
  const a11yScore = average([mobileScores.accessibility, htmlAnalysis?.a11yHtmlScore]);
  const securityScore = average([
    htmlAnalysis?.headerScore,
    mobileScores.bestPractices != null ? Math.min(mobileScores.bestPractices + 5, 100) : null,
  ]);
  const technicalScoreRaw = average([mobileScores.bestPractices, desktopScores.bestPractices]);

  // Local fallbacks when PageSpeed times out - never leave Performance/Technical blank
  let perfScore = perfScoreRaw;
  let technicalScore = technicalScoreRaw;
  let perfFallbackNote = null;
  let techFallbackNote = null;
  if (perfScore == null) {
    let est = 72;
    if (extra.images) est -= 8;
    if (extra.thirdParty?.count > 8) est -= 10;
    else if (extra.thirdParty?.count > 4) est -= 5;
    if (htmlAnalysis?.meta?.hasViewport === false) est -= 15;
    perfScore = clampScore(Math.max(35, est));
    perfFallbackNote =
      'PageSpeed was slow to answer this run, so this score is a local estimate from images, scripts, and page structure. Re-run later for full Lighthouse numbers.';
  }
  if (technicalScore == null) {
    let est = htmlAnalysis?.headerScore != null ? Math.min(88, htmlAnalysis.headerScore + 20) : 70;
    if (extra.llms?.found) est += 5;
    if (extra.robotsDetail?.status === 200) est += 3;
    technicalScore = clampScore(est);
    techFallbackNote =
      'Best-practices from PageSpeed did not return this run. Score below is from our TLS, robots, and page hygiene checks.';
  }

  const hostLabel = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return 'your site';
    }
  })();

  const sections = {
    performance: buildSection({
      id: 'performance',
      score: perfScore,
      url,
      reportToken,
      issues: [
        ...perfAudits.map((a) => ({
          severity: (a.score ?? 0) < 50 ? 'critical' : 'warn',
          text: a.displayValue ? `${a.title}: ${a.displayValue}` : a.title,
        })),
        ...(extra.images?.heaviest
          ? [{ severity: 'warn', text: `Heavy image signal from toolkit on homepage assets.` }]
          : []),
      ],
      findings: [
        mobileScores.performance != null
          ? { ok: mobileScores.performance >= 90, text: `Mobile performance score: ${mobileScores.performance}/100` }
          : null,
        desktopScores.performance != null
          ? { ok: desktopScores.performance >= 90, text: `Desktop performance score: ${desktopScores.performance}/100` }
          : null,
        perfFallbackNote ? { ok: false, text: perfFallbackNote } : null,
        extra.thirdParty?.count != null
          ? { ok: extra.thirdParty.count < 8, text: `Third-party scripts spotted: ~${extra.thirdParty.count}` }
          : null,
      ].filter(Boolean),
      tips: [
        ...perfAudits.map((a) => tipFromAudit(a.title)),
        extra.images ? 'Compress and properly size the heaviest homepage images; prefer modern formats.' : null,
        extra.thirdParty?.count > 6
          ? 'Trim or defer third-party tags that are not essential on first paint.'
          : null,
      ].filter(Boolean),
    }),
    seo: buildSection({
      id: 'seo',
      score: seoScore,
      url,
      reportToken,
      issues: [
        ...(htmlAnalysis?.seoIssues || []),
        ...(robots?.robotsIssues || []),
        ...seoAudits.map((a) => ({
          severity: (a.score ?? 0) < 50 ? 'critical' : 'warn',
          text: a.title,
        })),
        ...(extra.broken?.broken_count > 0
          ? [{ severity: 'warn', text: `Broken links detected on crawl sample (${extra.broken.broken_count}).` }]
          : []),
      ],
      findings: [
        ...(htmlAnalysis?.seoFindings || []),
        ...(robots?.robotsFindings || []),
        extra.social?.score != null
          ? { ok: extra.social.score >= 70, text: `Social meta toolkit score: ${extra.social.score}/100` }
          : null,
      ].filter(Boolean),
      tips: [
        ...(htmlAnalysis?.seoTips || []),
        ...(robots?.robotsTips || []),
        ...seoAudits.map((a) => tipFromAudit(a.title)),
        extra.social?.score < 70 ? 'Complete Open Graph / Twitter cards so shares look intentional.' : null,
      ].filter(Boolean),
    }),
    accessibility: buildSection({
      id: 'accessibility',
      score: a11yScore,
      url,
      reportToken,
      issues: [
        ...(htmlAnalysis?.a11yIssues || []),
        ...a11yAudits.map((a) => ({
          severity: (a.score ?? 0) < 50 ? 'critical' : 'warn',
          text: a.title,
        })),
        ...(Array.isArray(extra.a11y?.issues)
          ? extra.a11y.issues.slice(0, 4).map((t) => ({
              severity: 'warn',
              text: typeof t === 'string' ? t : t.message || t.text || 'Accessibility finding',
            }))
          : []),
      ],
      findings: htmlAnalysis?.a11yFindings || [],
      tips: [
        ...(htmlAnalysis?.a11yTips || []),
        ...a11yAudits.map((a) => tipFromAudit(a.title)),
      ].filter(Boolean),
    }),
    security: buildSection({
      id: 'security',
      score: securityScore,
      url,
      reportToken,
      issues: [...(htmlAnalysis?.securityIssues || []), ...(tls.issues || [])],
      findings: [...(htmlAnalysis?.securityFindings || []), ...(tls.findings || [])],
      tips: [...(htmlAnalysis?.securityTips || []), ...(tls.tips || [])],
    }),
    technical: buildSection({
      id: 'technical',
      score: technicalScore,
      url,
      reportToken,
      issues: [
        ...bpAudits.map((a) => ({
          severity: (a.score ?? 0) < 50 ? 'critical' : 'warn',
          text: a.title,
        })),
        ...(extra.llms?.found === false
          ? [{ severity: 'info', text: 'No llms.txt detected for AI / agentic crawlers.' }]
          : []),
      ],
      findings: [
        mobileScores.bestPractices != null
          ? { ok: mobileScores.bestPractices >= 90, text: `Best-practices score: ${mobileScores.bestPractices}/100` }
          : null,
        techFallbackNote ? { ok: false, text: techFallbackNote } : null,
        extra.llms?.found
          ? { ok: true, text: 'llms.txt (or similar AI policy file) detected.' }
          : null,
        extra.robotsDetail?.status === 200
          ? { ok: true, text: 'robots.txt reachable (toolkit).' }
          : null,
      ].filter(Boolean),
      tips: [
        ...bpAudits.map((a) => tipFromAudit(a.title)),
        extra.llms?.found === false
          ? 'Add a concise llms.txt pointing agents at the pages you want cited.'
          : null,
      ].filter(Boolean),
    }),
  };

  // Enrichment from full Sam runner removed (too slow for free product)

  const overall = average(SECTION_IDS.map((id) => sections[id].score));
  const topIssues = SECTION_IDS.flatMap((id) =>
    (sections[id].whatsWrong || []).slice(0, 2).map((issue) => ({
      section: id,
      sectionTitle: sections[id].title,
      ...issue,
    })),
  ).slice(0, 8);

  const weakId = SECTION_IDS
    .map((id) => ({ id, score: sections[id].score }))
    .filter((x) => typeof x.score === 'number')
    .sort((a, b) => a.score - b.score)[0]?.id;
  const seed = hashSeed(`${hostLabel}|${overall}|${weakId}|${(topIssues[0] || {}).text || ''}`);

  const headlinePools = {
    strong: [
      `${hostLabel} already looks hireable online`,
      `Good bones on ${hostLabel} - here is what still moves the needle`,
      `${hostLabel} is in better shape than most sites we scan`,
    ],
    mid: [
      `${hostLabel} has a clear path from "fine" to "sharp"`,
      `A few loud fixes would change how ${hostLabel} feels`,
      `${hostLabel} is close - these gaps are costing you quiet trust`,
    ],
    low: [
      `${hostLabel} has leverage sitting on the table`,
      `Start here: the issues on ${hostLabel} that visitors feel first`,
      `${hostLabel} needs a focused cleanup, not a mystery rebuild`,
    ],
    weakPerf: [
      `People on phones are waiting on ${hostLabel}`,
      `${hostLabel} looks fine until the clock starts - speed is the story`,
    ],
    weakSeo: [
      `Search is not getting a clean read on ${hostLabel}`,
      `${hostLabel} can show up clearer - titles and crawl signals first`,
    ],
    weakSec: [
      `${hostLabel} leaves a few security doors ajar`,
      `Hygiene first: harden ${hostLabel} before you spend on ads`,
    ],
  };

  let headlineBand = overall == null ? 'mid' : overall >= 85 ? 'strong' : overall >= 60 ? 'mid' : 'low';
  if (weakId === 'performance' && (sections.performance.score ?? 100) < 80) headlineBand = 'weakPerf';
  else if (weakId === 'seo' && (sections.seo.score ?? 100) < 80) headlineBand = 'weakSeo';
  else if (weakId === 'security' && (sections.security.score ?? 100) < 80) headlineBand = 'weakSec';

  const pool = headlinePools[headlineBand] || headlinePools.mid;
  const headline = pool[seed % pool.length];

  const summaryPools = [
    `Here is your free automated look at ${hostLabel}: speed, search basics, accessibility, security, and technical hygiene. Open each section for what stood out and a few fixes I would try first.`,
    `${hostLabel} is scored across five lanes below. This is the automated pass. Use the tips that fit your week. When you want the human DeepSite Analysis, that is the next step.`,
    `I scanned ${hostLabel} the way a visitor and a search engine would feel it. Start with the loudest issues, then dig into the sections that matter most to you.`,
  ];
  const summary = summaryPools[seed % summaryPools.length];

  const overview = {
    headline,
    summary,
    topIssues,
    sectionsNav: SECTION_IDS.map((id) => ({
      id,
      title: sections[id].title,
      score: sections[id].score,
      scoreLabel: sections[id].scoreLabel,
    })),
  };

  return {
    scores: {
      overall,
      overallLabel: scoreLabel(overall),
      mobile: mobileScores,
      desktop: desktopScores,
      bySection: Object.fromEntries(SECTION_IDS.map((id) => [id, sections[id].score])),
    },
    overview,
    sections,
    sectionOrder: SECTION_IDS,
    meta: {
      url,
      auditedAt: new Date().toISOString(),
      tools: [
        'Google PageSpeed Insights (Lighthouse)',
        'CreativeBuilds HTML & header checks',
        'TLS / HTTPS probe',
        'robots.txt / sitemap probe',
        'Sam toolkit: social meta, images, third-party, a11y, robots, llms.txt, broken links',
      ].filter(Boolean),
      errors,
    },
    raw: {
      psiMobileCategories: mobileScores,
      psiDesktopCategories: desktopScores,
      htmlMeta: htmlAnalysis?.meta || null,
      errors,
    },
  };
}

export { SECTION_IDS, SECTION_META };
