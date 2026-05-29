/**
 * Monetization Blueprint — discovers Stripe billing updates, drafts MVP payment integration tutorials.
 *
 * Config keys (admin JSON):
 *   allowed_tags  string[]  Stack whitelist (default: nextjs, nodejs, stripe, postgres, supabase)
 *   maxItems      number    Max discovery candidates (default: 5)
 *   autoPublish   boolean   Publish draft immediately (default: false)
 *   feedUrls      string[]  RSS/atom URLs to scan (default: Stripe blog feed)
 *
 * @param {import('../lib/blogAgentContext.js').ReturnType<typeof import('../lib/blogAgentContext.js').createAgentContext>} ctx
 */
import { generateJSON } from '../lib/llm.js';

const DEFAULT_TAGS = ['nextjs', 'nodejs', 'stripe', 'postgres', 'supabase'];
const DEFAULT_FEEDS = [
  'https://stripe.com/blog/feed.rss',
];
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
  },
];

export default async function run(ctx) {
  const allowedTags = ctx.config.allowed_tags || DEFAULT_TAGS;
  const maxItems = Number(ctx.config.maxItems) || 5;

  await ctx.step('discover', 'Scanning Stripe changelog and billing documentation feeds…');
  const externalData = await fetchExternalTriggers(ctx, maxItems);
  await ctx.checkpoint();

  if (!externalData || externalData.length === 0) {
    await ctx.log('No actionable triggers found during discovery cycle.', 'warn', 'discover');
    return {};
  }

  await ctx.step('analyze', 'Selecting monetization primitive for small-business MVP…');
  await ctx.log('Calling OpenAI to analyze Stripe billing candidates…', 'info', 'analyze');
  const validationResult = await analyzeCandidates(externalData, allowedTags);
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

  const post = await ctx.saveDraft({
    title: builtContent.title,
    slug: builtContent.slug || '',
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

async function fetchExternalTriggers(ctx, limit) {
  const feedUrls = ctx.config.feedUrls || DEFAULT_FEEDS;
  const candidates = [];

  for (const feedUrl of feedUrls) {
    try {
      const res = await fetchWithTimeout(feedUrl, {
        headers: { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': 'CreativeBuildsBlogAgent/1.0' },
      }, 12000);

      if (!res.ok) {
        await ctx.log(`Feed ${feedUrl} returned ${res.status}`, 'warn', 'discover');
        continue;
      }

      const xml = await res.text();
      const items = parseRssItems(xml, 5);

      for (const item of items) {
        candidates.push({
          id: `stripe-${hashSlug(item.title)}`,
          title: item.title,
          source: feedUrl.includes('stripe.com') ? 'stripe/blog' : 'rss',
          url: item.link,
          snippet: item.description.slice(0, 400),
          publishedAt: item.pubDate,
        });
      }
    } catch (err) {
      await ctx.log(`Feed ${feedUrl} fetch failed: ${err.message}`, 'warn', 'discover');
    }
  }

  if (candidates.length === 0) {
    await ctx.log('Live Stripe feeds empty — using seed candidates', 'warn', 'discover');
    return SEED_CANDIDATES.slice(0, limit);
  }

  return candidates.slice(0, limit);
}

function parseRssItems(xml, maxItems) {
  const items = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];

  for (const block of itemBlocks.slice(0, maxItems)) {
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link') || extractAttr(block, 'link', 'href');
    const description = extractTag(block, 'description') || extractTag(block, 'summary') || extractTag(block, 'content') || '';
    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'published') || '';

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

function stripCdata(str) {
  return str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
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
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(str) {
  return str.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function hashSlug(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
}

async function analyzeCandidates(data, allowedTags) {
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
Only use tags from: ${allowedTags.join(', ')}.
Reject patterns requiring enterprise Stripe Connect marketplace splits or complex tax nexus automation.`,
    user: `Stripe/billing candidates:\n${JSON.stringify(data, null, 2)}`,
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
1. Overview — why ${targetData.monetizationPrimitive} is the right MVP billing model
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

async function fetchWithTimeout(url, options = {}, ms = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
