/**
 * SaaS Bill Hunter — discovers SaaS pricing pain on Reddit/HN/IH, drafts custom-VPS alternative posts.
 *
 * Config keys (admin JSON):
 *   allowed_tags     string[]  Tech stack whitelist
 *   maxItems         number    Max ranked candidates passed to analyze (default: 5)
 *   autoPublish      boolean   Publish draft immediately (default: false)
 *   useSeedFallback  boolean   Use hardcoded seeds when live discovery empty (default: false)
 *   minScore         number    Minimum engagement score (default: 5)
 *   subreddits       string[]  Reddit subs to scan
 *   redditSorts      string[]  Reddit sorts: hot, top, new (default: hot, top, new)
 *   hnQueries        string[]  Hacker News Algolia search queries
 *   painKeywords     string[]  Optional keyword filter override
 *
 * @param {import('../lib/blogAgentContext.js').ReturnType<typeof import('../lib/blogAgentContext.js').createAgentContext>} ctx
 */
import { generateJSON } from '../lib/llm.js';
import {
  fetchRedditPosts,
  searchHackerNews,
  fetchRssFeed,
  gatherCandidates,
  filterByKeywords,
  filterSeenSources,
  rankCandidates,
  expandKeywordsFromTitles,
  hashSlug,
} from '../lib/agentDiscovery.js';

const DEFAULT_TAGS = ['react', 'nextjs', 'nodejs', 'tailwind', 'supabase', 'postgres', 'stripe'];
const BASE_PAIN_KEYWORDS = [
  'expensive', 'pricing', 'alternative', 'overpay', 'bill', 'cost', 'subscription',
  'zapier', 'hubspot', 'vercel', 'notion', 'airtable', 'slack', 'salesforce',
  'monthly fee', 'seat tax', 'too much', 'saas',
];
const DEFAULT_SUBREDDITS = ['saas', 'sideproject', 'smallbusiness', 'entrepreneur', 'startups'];
const DEFAULT_HN_QUERIES = ['SaaS pricing expensive', 'Zapier alternative', 'HubSpot pricing'];
const INDIE_HACKERS_FEED = 'https://www.indiehackers.com/feed.xml';

const SEED_CANDIDATES = [
  {
    id: 'seed-zapier',
    title: 'Zapier is getting too expensive for my small automation stack',
    source: 'reddit/r/saas',
    url: 'https://reddit.com/r/saas',
    snippet: 'Paying $240/mo for 20 zaps when I only need webhook routing and a cron job.',
    saasName: 'Zapier',
    monthlyCost: 240,
    techStack: ['nodejs', 'postgres'],
    score: 100,
  },
  {
    id: 'seed-hubspot',
    title: 'HubSpot pricing alternative for a 3-person sales team',
    source: 'reddit/r/smallbusiness',
    url: 'https://reddit.com/r/smallbusiness',
    snippet: 'Starter CRM features locked behind $800/mo tiers we cannot justify.',
    saasName: 'HubSpot',
    monthlyCost: 800,
    techStack: ['nextjs', 'postgres', 'stripe'],
    score: 100,
  },
];

export default async function run(ctx) {
  const allowedTags = ctx.config.allowed_tags || DEFAULT_TAGS;
  const maxItems = Number(ctx.config.maxItems) || 5;
  const minScore = Number(ctx.config.minScore) || 5;

  await ctx.step('discover', 'Scanning Reddit, Hacker News, and Indie Hackers for SaaS pricing pain…');
  const seenIds = await ctx.getRecentSourceIds(30);
  const externalData = await fetchExternalTriggers(ctx, maxItems, minScore, seenIds);
  await ctx.checkpoint();

  if (!externalData || externalData.length === 0) {
    await ctx.log('No actionable triggers found during discovery cycle.', 'warn', 'discover');
    return {};
  }

  await ctx.step('analyze', 'Evaluating candidates against technical scope and build feasibility…');
  await ctx.log(`Calling OpenAI to analyze ${externalData.length} ranked SaaS pain-point candidates…`, 'info', 'analyze');
  const validationResult = await analyzeCandidates(externalData, allowedTags, seenIds);
  await ctx.checkpoint();

  if (!validationResult.isValid) {
    await ctx.log(`Candidate skipped: ${validationResult.reason}`, 'info', 'analyze');
    return {};
  }

  await ctx.step('draft', 'Synthesizing SEO-optimized SaaS alternative article…');
  await ctx.log('Calling OpenAI to generate article (typically 30–90 seconds)…', 'info', 'draft');
  await ctx.checkpoint();
  const builtContent = await draftStructuredPost(validationResult.targetData, allowedTags);
  await ctx.checkpoint();

  validateBodyBlocks(builtContent.bodyBlocks);

  const post = await ctx.saveDraft({
    title: builtContent.title,
    slug: `${hashSlug(builtContent.title)}-${hashSlug(validationResult.targetData.id)}`.slice(0, 90),
    excerpt: builtContent.excerpt,
    body: builtContent.bodyBlocks,
    read_time: builtContent.readTime || '6 min',
    status: 'draft',
  });

  if (ctx.config.autoPublish === true) {
    await ctx.step('publish', `Committing draft to published state: ${post.id}`);
    await ctx.publishPost(post.id);
  }

  await ctx.step('done', `Agent execution successful. Created post: ${post.slug}`);
  return { postId: post.id, slug: post.slug, source: validationResult.targetData.id };
}

async function fetchExternalTriggers(ctx, limit, minScore, seenIds) {
  const subreddits = ctx.config.subreddits || DEFAULT_SUBREDDITS;
  const redditSorts = ctx.config.redditSorts || ['hot', 'top', 'new'];
  const hnQueries = ctx.config.hnQueries || DEFAULT_HN_QUERIES;
  const baseKeywords = ctx.config.painKeywords || BASE_PAIN_KEYWORDS;

  const fetchers = [];

  for (const sub of subreddits) {
    for (const sort of redditSorts) {
      fetchers.push(async () => {
        try {
          const posts = await fetchRedditPosts(sub, { sort, time: 'week', limit: 25 });
          return posts;
        } catch (err) {
          await ctx.log(`Reddit r/${sub}/${sort} failed: ${err.message}`, 'warn', 'discover');
          return [];
        }
      });
    }
  }

  for (const query of hnQueries) {
    fetchers.push(async () => {
      try {
        return await searchHackerNews(query, 10);
      } catch (err) {
        await ctx.log(`HN search "${query}" failed: ${err.message}`, 'warn', 'discover');
        return [];
      }
    });
  }

  fetchers.push(async () => {
    try {
      const items = await fetchRssFeed(INDIE_HACKERS_FEED, 10);
      return items.map((item) => ({
        id: `ih-${hashSlug(item.title)}`,
        title: item.title,
        source: 'indiehackers',
        url: item.link,
        snippet: item.description.slice(0, 400),
        rawText: `${item.title} ${item.description}`.toLowerCase(),
        upvotes: 10,
        comments: 0,
        publishedAt: item.pubDate || null,
        discoveredAt: new Date().toISOString(),
        engagement: { upvotes: 10, comments: 0 },
      }));
    } catch (err) {
      await ctx.log(`Indie Hackers feed failed: ${err.message}`, 'warn', 'discover');
      return [];
    }
  });

  const raw = await gatherCandidates(fetchers);
  const expanded = expandKeywordsFromTitles(rankCandidates(raw, 15), 10);
  const keywords = [...new Set([...baseKeywords, ...expanded])];

  const filtered = filterByKeywords(raw, keywords);
  const ranked = rankCandidates(filtered.length ? filtered : raw, limit * 2);
  const aboveMin = ranked.filter((c) => c.score >= minScore);
  const unseen = filterSeenSources(aboveMin.length ? aboveMin : ranked, seenIds);
  const final = unseen.slice(0, limit);

  await ctx.log(
    `Discovered ${raw.length} candidates, ${filtered.length} keyword matches, ranked top ${ranked.length}, skipping ${ranked.length - unseen.length} seen sources`,
    'info',
    'discover',
  );

  if (final.length === 0) {
    if (ctx.config.useSeedFallback === true) {
      await ctx.log('Live feeds empty — using seed candidates (useSeedFallback enabled)', 'warn', 'discover');
      return SEED_CANDIDATES.slice(0, limit);
    }
    return [];
  }

  return final;
}

async function analyzeCandidates(data, allowedTags, seenIds) {
  const schemaHint = `{
  "isValid": boolean,
  "reason": "string if rejected",
  "targetData": {
    "id": "string",
    "saasName": "string",
    "monthlyCost": number,
    "annualSavings": number,
    "techStack": ["string tags from allowed list only"],
    "problemSummary": "string",
    "buildComplexity": "simple|moderate|enterprise-only",
    "sourceTitle": "string",
    "sourceUrl": "string"
  }
}`;

  const result = await generateJSON({
    system: `You are a technical agency analyst. Pick ONE SaaS pain-point candidate that can be replaced with a lean Node/React automation on a $5 VPS.
Reject enterprise-only migrations (Salesforce org migrations, SAP, Oracle ERP).
Do NOT pick candidates whose id is in this already-covered list: ${seenIds.join(', ') || 'none'}.
Only use tech tags from this whitelist: ${allowedTags.join(', ')}.
If no candidate fits, set isValid false with a clear reason.`,
    user: `Top ranked candidates (pick the best ONE):\n${JSON.stringify(data, null, 2)}`,
    schemaHint,
    temperature: 0.2,
  });

  if (!result.isValid) {
    return { isValid: false, reason: result.reason || 'No viable candidate' };
  }

  const stack = result.targetData?.techStack || [];
  const outOfScope = stack.filter((t) => !allowedTags.includes(String(t).toLowerCase()));
  if (outOfScope.length > 0) {
    return {
      isValid: false,
      reason: `Tech stack ${outOfScope.join(', ')} outside allowed_tags scope`,
    };
  }

  if (result.targetData?.buildComplexity === 'enterprise-only') {
    return { isValid: false, reason: 'Enterprise-only migration rejected by guardrail' };
  }

  if (seenIds.includes(String(result.targetData?.id))) {
    return { isValid: false, reason: 'Source already covered in prior run' };
  }

  return { isValid: true, targetData: result.targetData };
}

async function draftStructuredPost(targetData, allowedTags) {
  const stackLabel = (targetData.techStack || allowedTags.slice(0, 3)).join(' + ');
  const monthly = targetData.monthlyCost || 99;
  const annual = monthly * 12;
  const vpsAnnual = 60;

  const schemaHint = `{
  "title": "string — follow blueprint: Stop Paying $X/Month for [SaaS]: How a Custom [Stack] Script on a $5 VPS Does the Same Job",
  "slug": "kebab-case-slug",
  "excerpt": "string — 1-2 sentences, keyword-rich",
  "readTime": "string e.g. 7 min",
  "bodyBlocks": ["string array — each element is one paragraph or ##/### heading block. Include code snippet and terminal commands as separate blocks."]
}`;

  const result = await generateJSON({
    system: `You write E-E-A-T SEO blog posts for a web agency that builds custom software on cheap VPS hosts.
Voice: first-person plural builder ("We deploy...", "In our production environments...").
Rules:
- NO dictionary definitions or generic fluff.
- First body block MUST include an outbound link to the source URL for E-E-A-T.
- Every H2/H3 section must answer the reader's question in the first two sentences (SGE optimization).
- Include proof-of-work: architecture diagram as text, a Node.js or React code snippet, and a docker-compose or nginx config block.
- Use only these tech tags: ${allowedTags.join(', ')}.
- End with a contextual CTA mapping the article problem to agency services (flat setup fee, no seat tax).`,
    user: `Write a SaaS alternative article.

Target SaaS: ${targetData.saasName}
Monthly cost: $${monthly}
Annual SaaS cost: $${annual}
VPS alternative cost: ~$5/mo ($${vpsAnnual}/yr)
Tech stack: ${stackLabel}
Problem: ${targetData.problemSummary || targetData.sourceTitle}
Source: ${targetData.sourceUrl || ''}

Body structure (each as separate bodyBlocks string):
1. Problem breakdown with outbound link to source — why founders overpay
2. ## The Hidden Costs of ${targetData.saasName}
3. ## Lean Architecture: ${stackLabel} on a $5 VPS
4. Code snippet mockup (Node cron + webhook handler or similar)
5. ## Financial Comparison — $${annual}/yr vs $${vpsAnnual}/yr VPS
6. Closing CTA: "Want this exact automation built, deployed, and managed for your business without the monthly seat tax? Let's vibe code it for a flat setup fee."`,
    schemaHint,
    temperature: 0.5,
  });

  return {
    title: result.title,
    slug: result.slug,
    excerpt: result.excerpt,
    bodyBlocks: Array.isArray(result.bodyBlocks) ? result.bodyBlocks : [String(result.bodyBlocks || '')],
    readTime: result.readTime || '6 min',
  };
}

function validateBodyBlocks(bodyBlocks) {
  if (!Array.isArray(bodyBlocks) || bodyBlocks.length === 0 || !bodyBlocks.some((b) => String(b).trim())) {
    throw new Error('LLM returned empty or invalid bodyBlocks array');
  }
}
