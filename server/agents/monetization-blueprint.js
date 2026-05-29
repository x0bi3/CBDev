/**
 * Monetization Blueprint — discovers Stripe billing trends, drafts MVP payment integration tutorials.
 *
 * Config keys (admin JSON):
 *   allowed_tags     string[]  Stack whitelist
 *   maxItems         number    Max ranked candidates (default: 5)
 *   autoPublish      boolean   Publish draft immediately (default: false)
 *   useSeedFallback  boolean   Use hardcoded seeds when live discovery empty (default: false)
 *   feedUrls         string[]  RSS/atom URLs to scan
 *   hnQueries        string[]  Hacker News search queries
 *
 * @param {import('../lib/blogAgentContext.js').ReturnType<typeof import('../lib/blogAgentContext.js').createAgentContext>} ctx
 */
import { generateJSON } from '../lib/llm.js';
import {
  fetchRssFeed,
  searchHackerNews,
  searchGitHubRepos,
  gatherCandidates,
  filterSeenSources,
  rankCandidates,
  inferMonetizationPrimitive,
  inferTechStackHints,
  hashSlug,
} from '../lib/agentDiscovery.js';

const DEFAULT_TAGS = ['nextjs', 'nodejs', 'stripe', 'postgres', 'supabase'];
const DEFAULT_FEEDS = [
  'https://stripe.com/blog/feed.rss',
  'https://stripe.com/docs/changelog.rss',
];
const DEFAULT_HN_QUERIES = ['Stripe billing', 'Stripe webhooks', 'micro SaaS payments'];

const SEED_CANDIDATES = [
  {
    id: 'seed-stripe-subs',
    title: 'Stripe Billing: multi-tier subscription pricing for SaaS MVPs',
    source: 'stripe/blog',
    url: 'https://stripe.com/billing',
    snippet: 'Launch tiered subscriptions with metered usage and customer portal in days, not months.',
    monetizationPrimitive: 'multi-tier subscriptions',
    databaseEngine: 'postgres',
    techStack: ['nextjs', 'stripe', 'postgres'],
    score: 100,
  },
  {
    id: 'seed-stripe-webhooks',
    title: 'Reliable Stripe webhook handling for invoice.payment_succeeded events',
    source: 'stripe/docs',
    url: 'https://stripe.com/docs/webhooks',
    snippet: 'Idempotent webhook processors prevent dropped payment events during deploys.',
    monetizationPrimitive: 'invoice webhooks',
    databaseEngine: 'supabase',
    techStack: ['nodejs', 'stripe', 'supabase'],
    score: 100,
  },
];

export default async function run(ctx) {
  const allowedTags = ctx.config.allowed_tags || DEFAULT_TAGS;
  const maxItems = Number(ctx.config.maxItems) || 5;

  await ctx.step('discover', 'Scanning Stripe feeds, Hacker News, and GitHub for billing trends…');
  const seenIds = await ctx.getRecentSourceIds(30);
  const externalData = await fetchExternalTriggers(ctx, maxItems, allowedTags, seenIds);
  await ctx.checkpoint();

  if (!externalData || externalData.length === 0) {
    await ctx.log('No actionable triggers found during discovery cycle.', 'warn', 'discover');
    return {};
  }

  await ctx.step('analyze', 'Selecting monetization primitive for small-business MVP…');
  await ctx.log(`Calling OpenAI to analyze ${externalData.length} Stripe billing candidates…`, 'info', 'analyze');
  const validationResult = await analyzeCandidates(externalData, allowedTags, seenIds);
  await ctx.checkpoint();

  if (!validationResult.isValid) {
    await ctx.log(`Candidate skipped: ${validationResult.reason}`, 'info', 'analyze');
    return {};
  }

  await ctx.step('draft', 'Synthesizing Stripe MVP monetization tutorial…');
  await ctx.log('Calling OpenAI to generate article (typically 30–90 seconds)…', 'info', 'draft');
  await ctx.checkpoint();
  const builtContent = await draftStructuredPost(validationResult.targetData, allowedTags);
  await ctx.checkpoint();

  validateBodyBlocks(builtContent.bodyBlocks);

  const post = await ctx.saveDraft({
    title: builtContent.title,
    slug: builtContent.slug || `${hashSlug(builtContent.title)}-${hashSlug(validationResult.targetData.id)}`.slice(0, 80),
    excerpt: builtContent.excerpt,
    body: builtContent.bodyBlocks,
    read_time: builtContent.readTime || '8 min',
    status: 'draft',
  });

  if (ctx.config.autoPublish === true) {
    await ctx.step('publish', `Committing draft to published state: ${post.id}`);
    await ctx.publishPost(post.id);
  }

  await ctx.step('done', `Agent execution successful. Created post: ${post.slug}`);
  return { postId: post.id, slug: post.slug, source: validationResult.targetData.id };
}

async function fetchExternalTriggers(ctx, limit, allowedTags, seenIds) {
  const feedUrls = ctx.config.feedUrls || DEFAULT_FEEDS;
  const hnQueries = ctx.config.hnQueries || DEFAULT_HN_QUERIES;
  const githubToken = process.env.GITHUB_TOKEN || '';
  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const fetchers = [];

  for (const feedUrl of feedUrls) {
    fetchers.push(async () => {
      try {
        const items = await fetchRssFeed(feedUrl, 8);
        return items.map((item) => {
          const text = `${item.title} ${item.description}`;
          return {
            id: `stripe-${hashSlug(item.title)}`,
            title: item.title,
            source: feedUrl.includes('changelog') ? 'stripe/changelog' : 'stripe/blog',
            url: item.link,
            snippet: item.description.slice(0, 400),
            publishedAt: item.pubDate || null,
            discoveredAt: new Date().toISOString(),
            upvotes: 15,
            engagement: { upvotes: 15 },
            monetizationPrimitive: inferMonetizationPrimitive(text),
            techStackHints: inferTechStackHints(text, allowedTags),
            rawText: text.toLowerCase(),
          };
        });
      } catch (err) {
        await ctx.log(`Feed ${feedUrl} failed: ${err.message}`, 'warn', 'discover');
        return [];
      }
    });
  }

  for (const query of hnQueries) {
    fetchers.push(async () => {
      try {
        const hits = await searchHackerNews(query, 8);
        return hits.map((h) => ({
          ...h,
          monetizationPrimitive: inferMonetizationPrimitive(`${h.title} ${h.snippet}`),
          techStackHints: inferTechStackHints(`${h.title} ${h.snippet}`, allowedTags),
        }));
      } catch (err) {
        await ctx.log(`HN search "${query}" failed: ${err.message}`, 'warn', 'discover');
        return [];
      }
    });
  }

  fetchers.push(async () => {
    try {
      const repos = await searchGitHubRepos(
        `"stripe subscription" pushed:>${since} stars:>50`,
        { token: githubToken, limit: 8, sort: 'updated' },
      );
      return repos.map((r) => ({
        ...r,
        monetizationPrimitive: inferMonetizationPrimitive(`${r.title} ${r.snippet}`),
        techStackHints: inferTechStackHints(`${r.title} ${r.snippet}`, allowedTags),
      }));
    } catch (err) {
      await ctx.log(`GitHub Stripe repo search failed: ${err.message}`, 'warn', 'discover');
      return [];
    }
  });

  const raw = await gatherCandidates(fetchers);
  const ranked = rankCandidates(raw, limit * 2);
  const unseen = filterSeenSources(ranked, seenIds);
  const final = unseen.slice(0, limit);

  await ctx.log(
    `Discovered ${raw.length} billing candidates, ranked top ${ranked.length}, skipping ${ranked.length - unseen.length} seen sources`,
    'info',
    'discover',
  );

  if (final.length === 0) {
    if (ctx.config.useSeedFallback === true) {
      await ctx.log('Live Stripe feeds empty — using seed candidates (useSeedFallback enabled)', 'warn', 'discover');
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
    "monetizationPrimitive": "string — e.g. usage-based billing, multi-tier subscriptions, invoice webhooks",
    "databaseEngine": "postgres|supabase",
    "techStack": ["string tags from allowed list only"],
    "mvpScope": "string — what a 48-hour MVP includes",
    "sourceTitle": "string",
    "sourceUrl": "string"
  }
}`;

  const result = await generateJSON({
    system: `You are a micro-SaaS monetization architect. Pick ONE Stripe billing pattern suitable for a small business MVP launchable in 48 hours.
Primitives: usage-based billing, multi-tier subscriptions, automated invoice webhooks, customer portal, checkout sessions.
Do NOT pick candidates whose id is in this already-covered list: ${seenIds.join(', ') || 'none'}.
Only use tags from: ${allowedTags.join(', ')}.
Reject patterns requiring enterprise Stripe Connect marketplace splits or complex tax nexus automation.
Prefer candidates with higher score and recent publishedAt.`,
    user: `Top ranked Stripe/billing candidates (each may include monetizationPrimitive and techStackHints):\n${JSON.stringify(data, null, 2)}`,
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

  if (seenIds.includes(String(result.targetData?.id))) {
    return { isValid: false, reason: 'Source already covered in prior run' };
  }

  return { isValid: true, targetData: result.targetData };
}

async function draftStructuredPost(targetData, allowedTags) {
  const db = targetData.databaseEngine || 'postgres';
  const stackLabel = (targetData.techStack || allowedTags.slice(0, 3)).join(' + ');

  const schemaHint = `{
  "title": "string — follow blueprint: How to Launch an MVP with Stripe Subscriptions and [Database Engine] in Under 48 Hours",
  "slug": "kebab-case-slug",
  "excerpt": "string",
  "readTime": "string",
  "bodyBlocks": ["string array — include code snippets for Stripe checkout, webhook handler, and route middleware as separate blocks"]
}`;

  const result = await generateJSON({
    system: `You write programmatic Stripe integration tutorials for a web agency building MVPs.
Voice: builder-first ("We wire Stripe checkout in production like this...").
Rules:
- NO fluff or dictionary definitions.
- First body block MUST include an outbound link to the source URL for E-E-A-T.
- H2/H3 sections answer the question in the first two sentences.
- Include real code: Stripe Checkout session creation, webhook signature verification, and paywall middleware.
- Use only: ${allowedTags.join(', ')}.
- Focus on ${targetData.monetizationPrimitive}.`,
    user: `Write a monetization blueprint tutorial.

Monetization primitive: ${targetData.monetizationPrimitive}
Database: ${db}
Stack: ${stackLabel}
MVP scope: ${targetData.mvpScope || 'Checkout + webhook + paywalled dashboard'}
Source inspiration: ${targetData.sourceTitle} — ${targetData.sourceUrl}

Body structure (each as separate bodyBlocks string):
1. Overview with outbound link to source — why ${targetData.monetizationPrimitive} is the right MVP billing model
2. ## Step-by-Step Payment Flows (Stripe Checkout + ${db} customer record)
3. Code: create checkout session endpoint
4. ## Handling Webhooks Without Dropping Requests (idempotency + signature verify)
5. Code: webhook handler for relevant Stripe events
6. ## Securing Paywalled Application Routes (middleware pattern)
7. ## Conversion Best Practices (pricing page, trial logic)
8. Closing CTA: "Need a bulletproof Stripe integration or multi-tenant checkout funnel built custom? We handle end-to-end web applications with custom infrastructure."`,
    schemaHint,
    temperature: 0.5,
  });

  return {
    title: result.title,
    slug: result.slug,
    excerpt: result.excerpt,
    bodyBlocks: Array.isArray(result.bodyBlocks) ? result.bodyBlocks : [String(result.bodyBlocks || '')],
    readTime: result.readTime || '8 min',
  };
}

function validateBodyBlocks(bodyBlocks) {
  if (!Array.isArray(bodyBlocks) || bodyBlocks.length === 0 || !bodyBlocks.some((b) => String(b).trim())) {
    throw new Error('LLM returned empty or invalid bodyBlocks array');
  }
}
