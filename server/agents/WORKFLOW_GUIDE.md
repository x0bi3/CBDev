# Blog agent workflow guide

Each workflow is one ES module in `server/agents/`. The runner loads it by `script_module` name (filename without `.js`) and calls your **default export** once per run.

---

## File contract

```
server/agents/<script_module>.js   ← must match blog_agents.script_module
```

```js
/** @param {import('../lib/blogAgentContext.js').ReturnType<typeof import('../lib/blogAgentContext.js').createAgentContext>} ctx */
export default async function run(ctx) {
  // pipeline here
  return { /* optional summary for run history */ };
}
```

- **One default export**, named `run` by convention (any async function works).
- **Do not** start your own HTTP server or cron — scheduling and lifecycle are handled by `blogAgentRunner.js`.
- Register new agents in `blog_agents` (migration or SQL) with matching `script_module`.

---

## Recommended pipeline shape

Use **phases** that map to admin-visible steps. Order should match how a human would describe progress.

| Phase | `ctx.step(id, message)` | What to do |
|-------|-------------------------|------------|
| Discover | `discover`, `scan`, `search` | Fetch external data (GitHub, YouTube, RSS, etc.) |
| Analyze | `analyze`, `seo`, `select` | Rank, keyword research, pick winner |
| Generate | `outline`, `draft`, `format` | Titles, structure, body copy |
| Publish | `publish`, `done` | Save draft and/or publish |

**Step IDs** (`id`): short, stable snake_case — reused across runs so logs are comparable (`scan`, not `scan_2024_05_28`).

**Messages**: full sentence shown live in admin, e.g. `Scanning GitHub for trending repos…` (user-facing, present tense).

Between long operations (API calls, LLM, transcoding), call **`await ctx.checkpoint()`** so Pause/Stop can take effect.

---

## Context API

| Method | When to use |
|--------|-------------|
| `ctx.step(id, message)` | Start a major phase — updates dashboard + writes info log |
| `ctx.log(message, level?, step?)` | Detail inside a phase (`info` \| `warn` \| `error`) |
| `ctx.checkpoint()` | After slow work, before next phase — honors pause/stop |
| `ctx.saveDraft({...})` | Insert `blog_posts` row (usually `status: 'draft'`) |
| `ctx.publishPost(postId)` | Set post to `published` with `published_at` |
| `ctx.config` | JSON from admin **Config** field (per-agent settings) |
| `ctx.agentSlug`, `ctx.runId` | Correlation / logging |
| `ctx.getRecentSourceIds(limit?)` | Source IDs from prior completed runs — use for deduplication |

### Discovery layer

Shared helpers live in [`server/lib/agentDiscovery.js`](../lib/agentDiscovery.js):

- `fetchRedditPosts`, `searchHackerNews`, `fetchRssFeed`, `searchGitHubRepos`, `fetchGitHubReleases`
- `discoverSelfHostedRepos`, `parseAwesomeSelfHostedRepos`
- `scoreCandidate`, `rankCandidates`, `filterSeenSources`, `gatherCandidates`

Agents should call `ctx.getRecentSourceIds()` during discover, pass top-ranked candidates (not raw dumps) to analyze, and return `{ source: targetData.id }` so repeat topics are skipped.

**Production config:** keep `useSeedFallback: false` so agents exit cleanly when live feeds are empty instead of regenerating stale seed content.

### `saveDraft` / `publishPost` fields

```js
await ctx.saveDraft({
  title: 'Required',
  slug: 'optional-auto-from-title',
  excerpt: '',
  body: ['Paragraph strings…', '## Section as its own string if you like'],
  read_time: '5 min',
  status: 'draft',           // or 'published'
  published_at: null,        // ISO string if scheduling publish
});
```

`body` is stored as JSON array of strings (same as manual Blog admin). The public site renders each entry as a paragraph/block.

### Return value

Optional JSON stored on the run record:

```js
return { postId: post.id, slug: post.slug, sources: ['repo-a', 'repo-b'] };
```

Failures: **throw** `new Error('clear message')` — run marked `failed`, message in admin.

Stop: runner throws `AgentStoppedError` when admin hits Stop — do not catch and swallow unless rethrowing.

---

## Config (admin JSON)

Put tunables in **Config JSON**, not hardcoded secrets:

```json
{
  "maxRepos": 5,
  "minStars": 1000,
  "autoPublish": false,
  "useSeedFallback": false,
  "minScore": 5,
  "publishMode": "draft"
}
```

Read with `ctx.config.maxRepos`. API keys belong in server `.env`, read inside the agent via `process.env.GITHUB_TOKEN`.

---

## Pause / stop behavior

- **Pause**: blocks at the next `step`, `log`, `checkpoint`, or after `demoDelay` (if you still use it).
- **Stop**: same checkpoints; run ends as `stopped`.
- Design loops as: *do chunk → `checkpoint()` → next chunk*.

---

## Scheduling vs manual

| Control | Behavior |
|---------|----------|
| **Start** (admin) | Immediate run, `trigger: manual` |
| **Enabled** + interval | Server runs when idle and interval elapsed (`trigger: scheduled`) |
| Default interval | `1440` minutes (24h) in seed data |

Only one run per agent at a time.

---

## Template skeleton

Copy when adding a workflow:

```js
export default async function run(ctx) {
  const limit = Number(ctx.config.limit) || 10;

  await ctx.step('discover', 'Short user-facing status…');
  const items = await fetchItems(limit);
  await ctx.checkpoint();

  await ctx.step('analyze', 'Analyzing candidates…');
  const pick = pickBest(items);
  await ctx.log(`Selected: ${pick.id}`, 'info', 'analyze');
  await ctx.checkpoint();

  await ctx.step('draft', 'Writing blog post…');
  const post = await ctx.saveDraft({
    title: pick.title,
    excerpt: pick.summary,
    body: buildParagraphs(pick),
    read_time: '6 min',
    status: 'draft',
  });

  if (ctx.config.autoPublish) {
    await ctx.step('publish', 'Publishing…');
    await ctx.publishPost(post.id);
  }

  await ctx.step('done', `Finished: ${post.slug}`);
  return { postId: post.id, slug: post.slug };
}

async function fetchItems(limit) {
  // your code
}
```

Keep **I/O and business logic** in plain functions; use `ctx` only for status + blog persistence.

---

## Checklist for a new agent

1. Add `server/agents/my-workflow.js` with `export default async function run(ctx)`.
2. Insert `blog_agents` row: `slug`, `name`, `description`, `script_module = 'my-workflow'`.
3. Define `config` keys and document them in a comment at top of file.
4. Use `ctx.step` for each phase admins should see.
5. Call `ctx.checkpoint()` after any operation &gt; ~1s.
6. End with `saveDraft` (review in **Blog**) or `publishPost` if trusted.
7. Test: **Start** → watch **Blog agents** live line + **History** log → confirm draft in **Blog**.

---

## Anti-patterns

- Long runs with no `step` / `checkpoint` — admin looks frozen; pause/stop delayed.
- Secrets in `config` JSON — use `.env` on the server.
- Multiple `saveDraft` without logging — hard to debug; `log` each candidate skipped.
- Catching all errors and returning `{}` — failed runs should throw.
- Separate processes calling the API — use this module contract so the runner owns lifecycle.

---

## Reference implementations

- `github-sniper.js` — discover → SEO → outline → draft (demo stub)
- `youtube-guru.js` — discover → select → transcribe → format → draft (demo stub)
- `saas-bill-hunter.js` — Reddit/HN/IH discovery → analyze → draft
- `self-hosted-champion.js` — GitHub releases + trending OSS → analyze → draft
- `monetization-blueprint.js` — Stripe feeds + HN + GitHub → analyze → draft

Replace `ctx.demoDelay()` with real work; remove demo delays in production agents.
