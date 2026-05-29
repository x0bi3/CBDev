/**
 * Blog ideas research — fetch, score, rank trending topics for CreativeBuilds blog.
 */

const USER_AGENT = 'CreativeBuildsBlogAgent/1.0';

export async function fetchWithTimeout(url, options = {}, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function stripCdata(str) {
  return String(str).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function extractTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1].trim() : '';
}

function extractAttr(block, tag, attr) {
  const m = block.match(new RegExp(`<${tag}[^>]*${attr}="([^"]+)"`));
  return m ? m[1] : '';
}

function decodeXml(str) {
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function stripHtml(str) {
  return String(str).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function hashSlug(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
}

export function normalizeTitle(title) {
  return String(title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function parseRssItems(xml, maxItems = 10) {
  const items = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];

  for (const block of itemBlocks.slice(0, maxItems)) {
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link') || extractAttr(block, 'link', 'href');
    const description = extractTag(block, 'description') || extractTag(block, 'summary') || extractTag(block, 'content') || '';
    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated') || '';

    if (title) {
      items.push({
        title: decodeXml(stripCdata(title)),
        link: stripCdata(link),
        description: stripHtml(decodeXml(stripCdata(description))),
        pubDate,
      });
    }
  }

  return items;
}

export function parseAtomEntries(xml, maxEntries = 10) {
  const entries = [];
  const entryBlocks = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];

  for (const block of entryBlocks.slice(0, maxEntries)) {
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link') || extractAttr(block, 'link', 'href');
    const summary = extractTag(block, 'summary') || extractTag(block, 'content') || '';
    const updated = extractTag(block, 'updated') || extractTag(block, 'published') || '';
    const id = extractTag(block, 'id') || title;

    if (title) {
      entries.push({
        id: id.replace(/[^a-z0-9-]/gi, '-').slice(0, 80),
        title: decodeXml(title),
        link: link || '',
        summary: stripHtml(decodeXml(summary)),
        updated,
      });
    }
  }

  return entries;
}

/**
 * @param {string} url
 * @param {number} limit
 * @returns {Promise<Array<{ title: string, link: string, description: string, pubDate: string }>>}
 */
export async function fetchRssFeed(url, limit = 10) {
  const res = await fetchWithTimeout(url, {
    headers: { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`RSS ${url} returned ${res.status}`);
  }

  const xml = await res.text();
  return parseRssItems(xml, limit);
}

/**
 * @param {string} sub
 * @param {{ sort?: string, time?: string, limit?: number }} opts
 */
export async function fetchRedditPosts(sub, { sort = 'hot', time = 'week', limit = 25 } = {}) {
  let url = `https://www.reddit.com/r/${sub}/${sort}.json?limit=${Math.min(limit, 100)}`;
  if (sort === 'top') url += `&t=${time}`;

  const res = await fetchWithTimeout(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`Reddit r/${sub}/${sort} returned ${res.status}`);
  }

  const json = await res.json();
  const posts = json?.data?.children || [];
  const now = Date.now();

  return posts.map((child) => {
    const p = child?.data || {};
    return {
      id: `reddit-${p.id}`,
      title: p.title || '',
      source: `reddit/r/${sub}`,
      url: p.permalink ? `https://reddit.com${p.permalink}` : '',
      snippet: (p.selftext || p.title || '').slice(0, 400),
      rawText: `${p.title || ''} ${p.selftext || ''}`.toLowerCase(),
      upvotes: p.score || 0,
      comments: p.num_comments || 0,
      publishedAt: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : null,
      discoveredAt: new Date(now).toISOString(),
      engagement: { upvotes: p.score || 0, comments: p.num_comments || 0 },
    };
  }).filter((p) => p.title);
}

/**
 * @param {string} query
 * @param {number} limit
 */
export async function searchHackerNews(query, limit = 10) {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${limit}`;
  const res = await fetchWithTimeout(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`HN search "${query}" returned ${res.status}`);
  }

  const json = await res.json();
  const hits = json?.hits || [];
  const now = Date.now();

  return hits.map((hit) => ({
    id: `hn-${hit.objectID}`,
    title: hit.title || '',
    source: 'hackernews',
    url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
    snippet: (hit.title || '').slice(0, 400),
    rawText: (hit.title || '').toLowerCase(),
    upvotes: hit.points || 0,
    comments: hit.num_comments || 0,
    publishedAt: hit.created_at || null,
    discoveredAt: new Date(now).toISOString(),
    engagement: { upvotes: hit.points || 0, comments: hit.num_comments || 0 },
  })).filter((p) => p.title);
}

/**
 * @param {string} query
 * @param {{ token?: string, limit?: number, sort?: string }} opts
 */
export async function searchGitHubRepos(query, { token, limit = 10, sort = 'stars' } = {}) {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=${sort}&order=desc&per_page=${limit}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': USER_AGENT,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetchWithTimeout(url, { headers }, 15000);

  if (!res.ok) {
    throw new Error(`GitHub search "${query}" returned ${res.status}`);
  }

  const json = await res.json();
  const items = json?.items || [];
  const now = Date.now();

  return items.map((repo) => ({
    id: `github-repo-${repo.full_name.replace('/', '-')}`,
    title: repo.full_name,
    source: `github/${repo.full_name}`,
    url: repo.html_url,
    snippet: (repo.description || repo.full_name).slice(0, 400),
    rawText: `${repo.full_name} ${repo.description || ''}`.toLowerCase(),
    upvotes: repo.stargazers_count || 0,
    comments: repo.open_issues_count || 0,
    publishedAt: repo.pushed_at || repo.updated_at || null,
    discoveredAt: new Date(now).toISOString(),
    engagement: { stars: repo.stargazers_count || 0, issues: repo.open_issues_count || 0 },
    repoFullName: repo.full_name,
  }));
}

/**
 * @param {string} repo — owner/name
 * @param {number} limit
 */
export async function fetchGitHubReleases(repo, limit = 3) {
  const url = `https://github.com/${repo}/releases.atom`;
  const res = await fetchWithTimeout(url, {
    headers: { Accept: 'application/atom+xml', 'User-Agent': USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`GitHub ${repo} atom feed returned ${res.status}`);
  }

  const xml = await res.text();
  const entries = parseAtomEntries(xml, limit);
  const now = Date.now();

  return entries.map((entry) => ({
    id: `github-${repo.replace('/', '-')}-${entry.id}`,
    title: entry.title,
    source: `github/${repo}`,
    url: entry.link,
    snippet: entry.summary.slice(0, 400),
    publishedAt: entry.updated || null,
    discoveredAt: new Date(now).toISOString(),
    engagement: {},
    repoFullName: repo,
  }));
}

const AWESOME_SELFHOSTED_RAW = 'https://raw.githubusercontent.com/awesome-selfhosted/awesome-selfhosted/master/README.md';

/**
 * @param {{ token?: string, limit?: number, daysBack?: number }} opts
 */
export async function discoverSelfHostedRepos({ token, limit = 15, daysBack = 30 } = {}) {
  const since = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);
  const query = `topic:self-hosted stars:>500 pushed:>${since}`;
  return searchGitHubRepos(query, { token, limit, sort: 'updated' });
}

/**
 * Parse awesome-selfhosted README for GitHub repo links.
 * @param {number} limit
 */
export async function parseAwesomeSelfHostedRepos(limit = 20) {
  const res = await fetchWithTimeout(AWESOME_SELFHOSTED_RAW, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`awesome-selfhosted README returned ${res.status}`);
  }

  const md = await res.text();
  const linkRe = /\[([^\]]+)\]\(https:\/\/github\.com\/([^/)]+)\/([^/)]+)\/?\)/g;
  const repos = [];
  const seen = new Set();
  let m;

  while ((m = linkRe.exec(md)) !== null && repos.length < limit * 3) {
    const fullName = `${m[2]}/${m[3]}`;
    if (seen.has(fullName) || fullName.startsWith('awesome-selfhosted/')) continue;
    seen.add(fullName);
    repos.push({
      name: m[1],
      fullName,
    });
  }

  return repos.slice(0, limit);
}

/**
 * Unified engagement score — higher is better.
 * @param {{ upvotes?: number, comments?: number, publishedAt?: string|null, discoveredAt?: string }} item
 * @param {{ commentWeight?: number, recencyHalfLifeDays?: number }} weights
 */
export function scoreCandidate(item, weights = {}) {
  const commentWeight = weights.commentWeight ?? 2;
  const halfLife = weights.recencyHalfLifeDays ?? 7;
  const upvotes = item.upvotes || item.engagement?.upvotes || item.engagement?.stars || 0;
  const comments = item.comments || item.engagement?.comments || item.engagement?.issues || 0;

  let recencyBoost = 0;
  const dateStr = item.publishedAt || item.discoveredAt;
  if (dateStr) {
    const ageMs = Date.now() - new Date(dateStr).getTime();
    const ageDays = ageMs / 86400000;
    recencyBoost = Math.max(0, 50 * Math.exp(-ageDays / halfLife));
  }

  return upvotes + comments * commentWeight + recencyBoost;
}

/**
 * Sort by score, dedupe by normalized title, return top N.
 * @param {Array<Record<string, unknown>>} candidates
 * @param {number} limit
 */
export function rankCandidates(candidates, limit = 5) {
  const scored = candidates.map((c) => ({
    ...c,
    score: scoreCandidate(c),
  }));

  scored.sort((a, b) => b.score - a.score);

  const seenTitles = new Set();
  const ranked = [];

  for (const c of scored) {
    const key = normalizeTitle(c.title);
    if (!key || seenTitles.has(key)) continue;
    seenTitles.add(key);
    ranked.push(c);
    if (ranked.length >= limit) break;
  }

  return ranked;
}

/**
 * @param {Array<{ id: string }>} candidates
 * @param {string[]} seenIds
 */
export function filterSeenSources(candidates, seenIds) {
  const seen = new Set(seenIds.map(String));
  return candidates.filter((c) => !seen.has(String(c.id)));
}

/**
 * Filter candidates whose text matches any keyword (case-insensitive).
 * @param {Array<{ rawText?: string, title?: string, snippet?: string }>} candidates
 * @param {string[]} keywords
 */
export function filterByKeywords(candidates, keywords) {
  if (!keywords.length) return candidates;
  return candidates.filter((c) => {
    const text = (c.rawText || `${c.title} ${c.snippet}`).toLowerCase();
    return keywords.some((kw) => text.includes(kw.toLowerCase()));
  });
}

/**
 * Extract recurring SaaS/pricing terms from top titles for dynamic keyword expansion.
 * @param {Array<{ title?: string, score?: number }>} ranked
 * @param {number} topN
 */
export function expandKeywordsFromTitles(ranked, topN = 10) {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
    'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can',
    'i', 'we', 'you', 'he', 'she', 'it', 'they', 'my', 'our', 'your', 'this', 'that',
    'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both',
    'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
    'same', 'so', 'than', 'too', 'very', 'just', 'about', 'from', 'into', 'through',
    'during', 'before', 'after', 'above', 'below', 'between', 'any', 'get', 'got', 'need',
  ]);

  const freq = new Map();
  const top = ranked.slice(0, topN);

  for (const item of top) {
    const words = String(item.title || '').toLowerCase().split(/[^a-z0-9]+/);
    for (const w of words) {
      if (w.length < 3 || stopWords.has(w)) continue;
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }

  return [...freq.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
}

/**
 * Parallel fetch with per-source error isolation.
 * @param {Array<() => Promise<Array>>} fetchers
 */
export async function gatherCandidates(fetchers) {
  const results = await Promise.allSettled(fetchers.map((fn) => fn()));
  const merged = [];

  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      merged.push(...r.value);
    }
  }

  return merged;
}

/**
 * Infer monetization primitive from title/snippet text.
 * @param {string} text
 */
export function inferMonetizationPrimitive(text) {
  const t = text.toLowerCase();
  if (/usage.?based|metered|pay.?as.?you.?go/.test(t)) return 'usage-based billing';
  if (/webhook|invoice\.payment|payment_intent/.test(t)) return 'invoice webhooks';
  if (/checkout.?session|one.?time|payment link/.test(t)) return 'checkout sessions';
  if (/customer portal|billing portal/.test(t)) return 'customer portal';
  if (/subscription|recurring|tier|pricing plan/.test(t)) return 'multi-tier subscriptions';
  return 'multi-tier subscriptions';
}

/**
 * Infer tech stack hints from text against allowed tags.
 * @param {string} text
 * @param {string[]} allowedTags
 */
export function inferTechStackHints(text, allowedTags) {
  const t = text.toLowerCase();
  return allowedTags.filter((tag) => t.includes(tag.toLowerCase()));
}
