/**
 * GitHub Sniper — template agent
 *
 * Replace the demo steps with your real pipeline:
 * GitHub API → SEO keywords → title/outline → draft post with links.
 *
 * @param {import('../lib/blogAgentContext.js').ReturnType<typeof import('../lib/blogAgentContext.js').createAgentContext>} ctx
 */
export default async function run(ctx) {
  const maxRepos = Number(ctx.config.maxRepos) || 5;

  await ctx.step('scan', 'Scanning GitHub for trending repos…');
  await ctx.demoDelay(1500);
  await ctx.log(`Picked top ${maxRepos} repos (demo)`, 'info', 'scan');

  await ctx.step('seo', 'Running SEO research on topics…');
  await ctx.demoDelay(1800);
  await ctx.log('Keyword cluster: open source, devtools, trending', 'info', 'seo');

  await ctx.step('outline', 'Building title, outline, and internal links…');
  await ctx.demoDelay(1200);

  const title = `Top ${maxRepos} GitHub repos developers are watching this week`;
  const post = await ctx.saveDraft({
    title,
    excerpt: 'A quick roundup of trending repositories — replace this stub with your generated copy.',
    body: [
      'This post was created by the **GitHub Sniper** agent (demo run). Wire your script to pull real repo data and SEO output here.',
      '## What to implement next',
      'Use the GitHub search/trending API, store candidates in ctx.config or a side table, then call ctx.saveDraft() with full paragraphs and outbound links.',
    ],
    read_time: '4 min',
    status: 'draft',
  });

  await ctx.step('done', `Draft ready: ${post.slug}`);
  return { postId: post.id, slug: post.slug };
}
