import { query } from '../db.js';
import { generateJSON } from './llm.js';
import {
  fetchRedditPosts,
  searchHackerNews,
  fetchRssFeed,
  gatherCandidates,
  rankCandidates,
  normalizeTitle,
} from './blogIdeasResearch.js';

const SUBREDDITS = ['saas', 'sideproject', 'webdev', 'reactjs', 'startups'];
const HN_QUERIES = ['web development tutorial', 'self hosted', 'stripe saas', 'github template website'];
const RSS_FEEDS = ['https://stripe.com/blog/feed.rss'];

async function discoverRawCandidates() {
  const fetchers = [];

  for (const sub of SUBREDDITS) {
    fetchers.push(async () => fetchRedditPosts(sub, { sort: 'hot', limit: 15 }));
    fetchers.push(async () => fetchRedditPosts(sub, { sort: 'top', time: 'week', limit: 10 }));
  }

  for (const q of HN_QUERIES) {
    fetchers.push(async () => searchHackerNews(q, 8));
  }

  for (const url of RSS_FEEDS) {
    fetchers.push(async () => {
      const items = await fetchRssFeed(url, 5);
      return items.map((item) => ({
        id: `rss-${item.title}`,
        title: item.title,
        source: 'rss',
        url: item.link,
        snippet: item.description.slice(0, 400),
        upvotes: 10,
        publishedAt: item.pubDate || null,
      }));
    });
  }

  return gatherCandidates(fetchers);
}

async function getExistingTitles() {
  const { rows } = await query(`
    SELECT title FROM blog_ideas WHERE status IN ('suggested', 'dismissed', 'used')
    UNION
    SELECT title FROM blog_posts
  `);
  return new Set(rows.map((r) => normalizeTitle(r.title)));
}

/**
 * Run research pipeline: discover → rank → LLM → persist blog_ideas.
 * @returns {Promise<{ added: number, candidates: number }>}
 */
export async function runBlogIdeasResearch() {
  const raw = await discoverRawCandidates();
  const ranked = rankCandidates(raw, 20);
  const existing = await getExistingTitles();
  const fresh = ranked.filter((c) => !existing.has(normalizeTitle(c.title)));

  if (fresh.length === 0) {
    return { added: 0, candidates: raw.length };
  }

  const schemaHint = `{
  "ideas": [{
    "title": "string — blog post title idea for CreativeBuilds audience",
    "angle": "string — unique angle (how-to, alternative, tutorial)",
    "rationale": "string — why this drives inbound traffic",
    "keywords": ["string"],
    "sourceTitle": "string",
    "sourceUrl": "string",
    "score": number
  }]
}`;

  const result = await generateJSON({
    system: `You are a content strategist for CreativeBuilds — a solo dev agency offering affordable web design, app development, VPS-hosted custom software, and Stripe integrations.
Pick up to 5 blog ideas from the trending candidates. Focus on: web dev tutorials, self-hosted/VPS, SaaS alternatives, Stripe MVPs, GitHub templates, automation.
Each idea must be actionable for a builder audience. Avoid generic fluff.`,
    user: `Trending candidates:\n${JSON.stringify(fresh.slice(0, 15), null, 2)}`,
    schemaHint,
    temperature: 0.3,
  });

  const ideas = Array.isArray(result.ideas) ? result.ideas : [];
  let added = 0;

  for (const idea of ideas.slice(0, 5)) {
    const title = String(idea.title || '').trim();
    if (!title || existing.has(normalizeTitle(title))) continue;

    await query(
      `INSERT INTO blog_ideas (title, angle, rationale, keywords, source, source_url, score, status)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, 'suggested')`,
      [
        title,
        idea.angle || '',
        idea.rationale || '',
        JSON.stringify(idea.keywords || []),
        idea.sourceTitle || 'research',
        idea.sourceUrl || '',
        Number(idea.score) || 50,
      ],
    );
    existing.add(normalizeTitle(title));
    added += 1;
  }

  return { added, candidates: raw.length };
}
