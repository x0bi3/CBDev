/**
 * Self-Hosted Champion — discovers OSS releases, drafts VPS deployment highlight posts.
 *
 * Config keys (admin JSON):
 *   allowed_tags  string[]  Deployment stack whitelist (default: docker, nodejs, postgres, coolify, caprover)
 *   maxItems      number    Max discovery candidates (default: 5)
 *   autoPublish   boolean   Publish draft immediately (default: false)
 *   repos         string[]  GitHub owner/repo pairs to watch (default: awesome-selfhosted/awesome-selfhosted, pocketbase/pocketbase, coolifyio/coolify, caprover/caprover)
 *
 * @param {import('../lib/blogAgentContext.js').ReturnType<typeof import('../lib/blogAgentContext.js').createAgentContext>} ctx
 */
import { generateJSON } from '../lib/llm.js';

const DEFAULT_TAGS = ['docker', 'nodejs', 'postgres', 'coolify', 'caprover', 'nginx'];
const DEFAULT_REPOS = [
  'awesome-selfhosted/awesome-selfhosted',
  'pocketbase/pocketbase',
  'coolifyio/coolify',
  'caprover/caprover',
  'umami-software/umami',
  'n8n-io/n8n',
];
const SEED_CANDIDATES = [
  {
    id: 'seed-pocketbase',
    title: 'PocketBase v0.23 — embedded SQLite realtime backend',
    source: 'github/pocketbase/pocketbase',
    url: 'https://github.com/pocketbase/pocketbase/releases',
    snippet: 'Open-source Firebase alternative with auth, file storage, and realtime subscriptions.',
    ossName: 'PocketBase',
    commercialCompetitor: 'Firebase',
    techStack: ['docker', 'nodejs'],
  },
  {
    id: 'seed-umami',
    title: 'Umami — privacy-first web analytics',
    source: 'github/umami-software/umami',
    url: 'https://github.com/umami-software/umami/releases',
    snippet: 'Self-hosted Google Analytics alternative with zero cookie banners required.',
    ossName: 'Umami',
    commercialCompetitor: 'Google Analytics 360',
    techStack: ['docker', 'postgres'],
  },
];

export default async function run(ctx) {
  const allowedTags = ctx.config.allowed_tags || DEFAULT_TAGS;
  const maxItems = Number(ctx.config.maxItems) || 5;

  await ctx.step('discover', 'Scanning GitHub release feeds for self-hosted software updates…');
  const externalData = await fetchExternalTriggers(ctx, maxItems);
  await ctx.checkpoint();

  if (!externalData || externalData.length === 0) {
    await ctx.log('No actionable triggers found during discovery cycle.', 'warn', 'discover');
    return {};
  }

  await ctx.step('analyze', 'Mapping open-source tools to commercial alternatives…');
  const validationResult = await analyzeCandidates(externalData, allowedTags);
  await ctx.checkpoint();

  if (!validationResult.isValid) {
    await ctx.log(`Candidate skipped: ${validationResult.reason}`, 'info', 'analyze');
    return {};
  }

  await ctx.step('draft', 'Synthesizing self-hosted deployment highlight article…');
  const builtContent = await draftStructuredPost(validationResult.targetData, allowedTags);
  await ctx.checkpoint();

  const post = await ctx.saveDraft({
    title: builtContent.title,
    slug: builtContent.slug || '',
    excerpt: builtContent.excerpt,
    body: builtContent.bodyBlocks,
    read_time: builtContent.readTime || '7 min',
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
  const repos = ctx.config.repos || DEFAULT_REPOS;
  const candidates = [];

  for (const repo of repos) {
    try {
      const url = `https://github.com/${repo}/releases.atom`;
      const res = await fetchWithTimeout(url, {
        headers: { Accept: 'application/atom+xml', 'User-Agent': 'CreativeBuildsBlogAgent/1.0' },
      }, 12000);

      if (!res.ok) {
        await ctx.log(`GitHub ${repo} atom feed returned ${res.status}`, 'warn', 'discover');
        continue;
      }

      const xml = await res.text();
      const entries = parseAtomEntries(xml, 3);

      for (const entry of entries) {
        candidates.push({
          id: `github-${repo.replace('/', '-')}-${entry.id}`,
          title: entry.title,
          source: `github/${repo}`,
          url: entry.link,
          snippet: entry.summary.slice(0, 400),
          publishedAt: entry.updated,
        });
      }
    } catch (err) {
      await ctx.log(`GitHub ${repo} fetch failed: ${err.message}`, 'warn', 'discover');
    }
  }

  if (candidates.length === 0) {
    await ctx.log('Live GitHub feeds empty — using seed candidates', 'warn', 'discover');
    return SEED_CANDIDATES.slice(0, limit);
  }

  return candidates.slice(0, limit);
}

function parseAtomEntries(xml, maxEntries) {
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

async function analyzeCandidates(data, allowedTags) {
  const schemaHint = `{
  "isValid": boolean,
  "reason": "string if rejected",
  "targetData": {
    "id": "string",
    "ossName": "string",
    "commercialCompetitor": "string",
    "businessUtility": "string — one sentence value prop",
    "techStack": ["string tags from allowed list only"],
    "deploymentTool": "coolify|caprover|docker-compose",
    "sourceTitle": "string",
    "sourceUrl": "string"
  }
}`;

  const result = await generateJSON({
    system: `You are an open-source infrastructure analyst for a VPS deployment agency.
Pick ONE self-hosted tool that replaces a commercial SaaS (e.g. PocketBase=Firebase, Umami=Google Analytics, n8n=Zapier).
Only use deployment tags from: ${allowedTags.join(', ')}.
Reject tools requiring Kubernetes clusters or dedicated GPU hardware.`,
    user: `Release candidates:\n${JSON.stringify(data, null, 2)}`,
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
      reason: `Deployment stack ${outOfScope.join(', ')} outside allowed_tags scope`,
    };
  }

  return { isValid: true, targetData: result.targetData };
}

async function draftStructuredPost(targetData, allowedTags) {
  const deployTool = targetData.deploymentTool || 'docker-compose';

  const schemaHint = `{
  "title": "string — follow blueprint: Ditch [Commercial Competitor] Plans: Why We Build and Host Client Software Using [Open Source Alternative]",
  "slug": "kebab-case-slug",
  "excerpt": "string",
  "readTime": "string",
  "bodyBlocks": ["string array — paragraphs and ##/### headings as separate elements"]
}`;

  const result = await generateJSON({
    system: `You write E-E-A-T technical product reviews for an agency deploying open-source on private VPS instances.
Voice: builder-first ("We deploy...", "In our client environments...").
Rules:
- NO generic marketing fluff.
- H2/H3 sections answer the question in the first two sentences.
- Include a deployment blueprint: docker-compose.yml or Coolify/CapRover setup steps as code blocks.
- Mention data privacy and data sovereignty advantages.
- Use deployment tags: ${allowedTags.join(', ')}.`,
    user: `Write a self-hosted champion article.

Open-source hero: ${targetData.ossName}
Commercial competitor: ${targetData.commercialCompetitor}
Business utility: ${targetData.businessUtility}
Deployment tool: ${deployTool}
Source: ${targetData.sourceTitle} — ${targetData.sourceUrl}

Body structure (each as separate bodyBlocks string):
1. Introduction to ${targetData.ossName} as the open-source hero
2. ## Why Performance Beats ${targetData.commercialCompetitor} Cloud Configurations
3. ## Deployment Blueprint on a Standard VPS (${deployTool})
4. Include docker-compose or CapRover one-click deploy commands
5. ## Data Privacy and Sovereignty Advantages
6. Closing CTA: "We setup, secure, and maintain open-source software networks on private VPS instances for a tiny recurring maintenance fee. Secure your data today."`,
    schemaHint,
    temperature: 0.5,
  });

  return {
    title: result.title,
    slug: result.slug,
    excerpt: result.excerpt,
    bodyBlocks: Array.isArray(result.bodyBlocks) ? result.bodyBlocks : [String(result.bodyBlocks || '')],
    readTime: result.readTime || '7 min',
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
