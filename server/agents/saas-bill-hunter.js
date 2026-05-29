/**
 * SaaS Bill Hunter — discovers SaaS pricing pain on Reddit, drafts custom-VPS alternative posts.
 *
 * Config keys (admin JSON):
 *   allowed_tags  string[]  Tech stack whitelist (default: react, nextjs, nodejs, tailwind, supabase, postgres, stripe)
 *   maxItems      number    Max discovery candidates (default: 5)
 *   autoPublish   boolean   Publish draft immediately (default: false)
 *   subreddits    string[]  Reddit subs to scan (default: saas, sideproject, smallbusiness)
 *
 * @param {import('../lib/blogAgentContext.js').ReturnType<typeof import('../lib/blogAgentContext.js').createAgentContext>} ctx
 */
import { generateJSON } from '../lib/llm.js';

const DEFAULT_TAGS = ['react', 'nextjs', 'nodejs', 'tailwind', 'supabase', 'postgres', 'stripe'];
const PAIN_KEYWORDS = [
  'expensive', 'pricing', 'alternative', 'overpay', 'bill', 'cost', 'subscription',
  'zapier', 'hubspot', 'vercel', 'notion', 'airtable', 'slack', 'salesforce',
  'monthly fee', 'seat tax', 'too much',
];
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
  },
];

export default async function run(ctx) {
  const allowedTags = ctx.config.allowed_tags || DEFAULT_TAGS;
  const maxItems = Number(ctx.config.maxItems) || 5;

  await ctx.step('discover', 'Scanning Reddit for SaaS pricing pain points…');
  const externalData = await fetchExternalTriggers(ctx, maxItems);
  await ctx.checkpoint();

  if (!externalData || externalData.length === 0) {
    await ctx.log('No actionable triggers found during discovery cycle.', 'warn', 'discover');
    return {};
  }

  await ctx.step('analyze', 'Evaluating candidates against technical scope and build feasibility…');
  const validationResult = await analyzeCandidates(externalData, allowedTags);
  await ctx.checkpoint();

  if (!validationResult.isValid) {
    await ctx.log(`Candidate skipped: ${validationResult.reason}`, 'info', 'analyze');
    return {};
  }

  await ctx.step('draft', 'Synthesizing SEO-optimized SaaS alternative article…');
  const builtContent = await draftStructuredPost(validationResult.targetData, allowedTags);
  await ctx.checkpoint();

  const post = await ctx.saveDraft({
    title: builtContent.title,
    slug: builtContent.slug || '',
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

async function fetchExternalTriggers(ctx, limit) {
  const subreddits = ctx.config.subreddits || ['saas', 'sideproject', 'smallbusiness'];
  const candidates = [];

  for (const sub of subreddits) {
    try {
      const url = `https://www.reddit.com/r/${sub}/new.json?limit=${Math.min(limit, 25)}`;
      const res = await fetchWithTimeout(url, {
        headers: { 'User-Agent': 'CreativeBuildsBlogAgent/1.0' },
      }, 12000);

      if (!res.ok) {
        await ctx.log(`Reddit r/${sub} returned ${res.status}`, 'warn', 'discover');
        continue;
      }

      const json = await res.json();
      const posts = json?.data?.children || [];

      for (const child of posts) {
        const p = child?.data;
        if (!p?.title) continue;
        const text = `${p.title} ${p.selftext || ''}`.toLowerCase();
        if (!PAIN_KEYWORDS.some((kw) => text.includes(kw))) continue;

        candidates.push({
          id: `reddit-${p.id}`,
          title: p.title,
          source: `reddit/r/${sub}`,
          url: `https://reddit.com${p.permalink}`,
          snippet: (p.selftext || p.title).slice(0, 400),
          rawText: text,
        });
      }
    } catch (err) {
      await ctx.log(`Reddit r/${sub} fetch failed: ${err.message}`, 'warn', 'discover');
    }
  }

  if (candidates.length === 0) {
    await ctx.log('Live Reddit feeds empty — using seed candidates', 'warn', 'discover');
    return SEED_CANDIDATES.slice(0, limit);
  }

  return candidates.slice(0, limit);
}

async function analyzeCandidates(data, allowedTags) {
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
Only use tech tags from this whitelist: ${allowedTags.join(', ')}.
If no candidate fits, set isValid false with a clear reason.`,
    user: `Candidates:\n${JSON.stringify(data, null, 2)}`,
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
1. Problem breakdown — why founders overpay
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

async function fetchWithTimeout(url, options = {}, ms = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
