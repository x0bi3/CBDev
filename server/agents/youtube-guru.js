/**
 * YouTube Guru — template agent
 *
 * Replace demo steps with: discover videos → fetch transcript → structure how-to post.
 *
 * @param {import('../lib/blogAgentContext.js').ReturnType<typeof import('../lib/blogAgentContext.js').createAgentContext>} ctx
 */
export default async function run(ctx) {
  const maxVideos = Number(ctx.config.maxVideos) || 3;

  await ctx.step('discover', 'Searching for how-to videos…');
  await ctx.demoDelay(1400);
  await ctx.log(`Found ${maxVideos} candidate videos (demo)`, 'info', 'discover');

  await ctx.step('select', 'Found guide — picking best match…');
  await ctx.demoDelay(1000);

  await ctx.step('transcribe', 'Transcribing audio to text…');
  await ctx.demoDelay(2200);
  await ctx.log('Transcript chunked into sections', 'info', 'transcribe');

  await ctx.step('format', 'Formatting how-to blog post…');
  await ctx.demoDelay(1500);

  const post = await ctx.saveDraft({
    title: 'How to get started (demo from YouTube Guru)',
    excerpt: 'Step-by-step guide generated from a video transcript — stub content.',
    body: [
      '## Step 1 — Overview',
      'Replace this block with your transcript-to-markdown pipeline.',
      '## Step 2 — Setup',
      'Add screenshots, timestamps, and embed links as needed.',
      '## Step 3 — Wrap up',
      'The YouTube Guru agent saved this as a draft for your review in Blog.',
    ],
    read_time: '6 min',
    status: 'draft',
  });

  await ctx.step('done', `How-to draft saved: ${post.slug}`);
  return { postId: post.id, slug: post.slug };
}
