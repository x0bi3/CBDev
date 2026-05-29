/**
 * Self-Hosted Champion — discovers trending OSS releases, drafts VPS deployment highlight posts.
 *
 * Config keys (admin JSON):
 *   allowed_tags     string[]  Deployment stack whitelist
 *   maxItems         number    Max ranked candidates (default: 5)
 *   autoPublish      boolean   Publish draft immediately (default: false)
 *   useSeedFallback  boolean   Use hardcoded seeds when live discovery empty (default: false)
 *   repos            string[]  GitHub owner/repo pairs to watch for releases
 *
 * @param {import('../lib/blogAgentContext.js').ReturnType<typeof import('../lib/blogAgentContext.js').createAgentContext>} ctx
 */
import { generateJSON } from '../lib/llm.js';
import {
  fetchGitHubReleases,
  discoverSelfHostedRepos,
  parseAwesomeSelfHostedRepos,
  gatherCandidates,
  filterSeenSources,
  rankCandidates,
  scoreCandidate,
  hashSlug,
} from '../lib/agentDiscovery.js';

const DEFAULT_TAGS = ['docker', 'nodejs', 'postgres', 'coolify', 'caprover', 'nginx'];
const DEFAULT_REPOS = [
  'pocketbase/pocketbase',
  'coolifyio/coolify',
  'caprover/caprover',
  'umami-software/umami',
  'n8n-io/n8n',
  'plausible/analytics',
  'appwrite/appwrite',
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
    score: 100,
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
    score: 100,
  },
];

export default async function run(ctx) {
  const allowedTags = ctx.config.allowed_tags || DEFAULT_TAGS;
  const maxItems = Number(ctx.config.maxItems) || 5;

  await ctx.step('discover', 'Scanning GitHub releases and trending self-hosted repos…');
  const seenIds = await ctx.getRecentSourceIds(30);
  const externalData = await fetchExternalTriggers(ctx, maxItems, seenIds);
  await ctx.checkpoint();

  if (!externalData || externalData.length === 0) {
    await ctx.log('No actionable triggers found during discovery cycle.', 'warn', 'discover');
    return {};
  }

  await ctx.step('analyze', 'Mapping open-source tools to commercial alternatives…');
  await ctx.log(`Calling OpenAI to analyze ${externalData.length} self-hosted candidates…`, 'info', 'analyze');
  const validationResult = await analyzeCandidates(externalData, allowedTags, seenIds);
  await ctx.checkpoint();

  if (!validationResult.isValid) {
    await ctx.log(`Candidate skipped: ${validationResult.reason}`, 'info', 'analyze');
    return {};
  }

  await ctx.step('draft', 'Synthesizing self-hosted deployment highlight article…');
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

async function fetchExternalTriggers(ctx, limit, seenIds) {
  const repos = ctx.config.repos || DEFAULT_REPOS;
  const githubToken = process.env.GITHUB_TOKEN || '';
  const fetchers = [];

  for (const repo of repos) {
    fetchers.push(async () => {
      try {
        const releases = await fetchGitHubReleases(repo, 3);
        return releases.map((r) => ({
          ...r,
          type: 'release',
          upvotes: scoreCandidate(r, { recencyHalfLifeDays: 3 }),
        }));
      } catch (err) {
        await ctx.log(`GitHub ${repo} releases failed: ${err.message}`, 'warn', 'discover');
        return [];
      }
    });
  }

  fetchers.push(async () => {
    try {
      const trending = await discoverSelfHostedRepos({ token: githubToken, limit: 10, daysBack: 30 });
      return trending.map((r) => ({
        ...r,
        type: 'trending',
        title: `${r.title} — trending self-hosted`,
      }));
    } catch (err) {
      await ctx.log(`GitHub self-hosted search failed: ${err.message}`, 'warn', 'discover');
      return [];
    }
  });

  fetchers.push(async () => {
    try {
      const awesome = await parseAwesomeSelfHostedRepos(10);
      return awesome.map((r) => ({
        id: `awesome-${r.fullName.replace('/', '-')}`,
        title: `${r.name} (${r.fullName})`,
        source: `awesome-selfhosted/${r.fullName}`,
        url: `https://github.com/${r.fullName}`,
        snippet: `Curated self-hosted alternative: ${r.name}`,
        type: 'awesome-list',
        upvotes: 20,
        publishedAt: new Date().toISOString(),
        discoveredAt: new Date().toISOString(),
        engagement: { stars: 20 },
      }));
    } catch (err) {
      await ctx.log(`awesome-selfhosted parse failed: ${err.message}`, 'warn', 'discover');
      return [];
    }
  });

  const raw = await gatherCandidates(fetchers);
  const ranked = rankCandidates(raw, limit * 2);
  const unseen = filterSeenSources(ranked, seenIds);
  const final = unseen.slice(0, limit);

  await ctx.log(
    `Discovered ${raw.length} OSS candidates, ranked top ${ranked.length}, skipping ${ranked.length - unseen.length} seen sources`,
    'info',
    'discover',
  );

  if (final.length === 0) {
    if (ctx.config.useSeedFallback === true) {
      await ctx.log('Live GitHub feeds empty — using seed candidates (useSeedFallback enabled)', 'warn', 'discover');
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
commercialCompetitor MUST be a named commercial product — reject if you cannot identify one.
Do NOT pick candidates whose id is in this already-covered list: ${seenIds.join(', ') || 'none'}.
Only use deployment tags from: ${allowedTags.join(', ')}.
Reject tools requiring Kubernetes clusters or dedicated GPU hardware.`,
    user: `Top ranked release/trending candidates:\n${JSON.stringify(data, null, 2)}`,
    schemaHint,
    temperature: 0.2,
  });

  if (!result.isValid) {
    return { isValid: false, reason: result.reason || 'No viable candidate' };
  }

  if (!result.targetData?.commercialCompetitor) {
    return { isValid: false, reason: 'No identifiable commercial competitor' };
  }

  const stack = result.targetData?.techStack || [];
  const outOfScope = stack.filter((t) => !allowedTags.includes(String(t).toLowerCase()));
  if (outOfScope.length > 0) {
    return {
      isValid: false,
      reason: `Deployment stack ${outOfScope.join(', ')} outside allowed_tags scope`,
    };
  }

  if (seenIds.includes(String(result.targetData?.id))) {
    return { isValid: false, reason: 'Source already covered in prior run' };
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
- First body block MUST include an outbound link to the source URL for E-E-A-T.
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
1. Introduction to ${targetData.ossName} with outbound link to source
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

function validateBodyBlocks(bodyBlocks) {
  if (!Array.isArray(bodyBlocks) || bodyBlocks.length === 0 || !bodyBlocks.some((b) => String(b).trim())) {
    throw new Error('LLM returned empty or invalid bodyBlocks array');
  }
}
