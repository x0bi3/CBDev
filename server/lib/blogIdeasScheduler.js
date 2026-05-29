import { runBlogIdeasResearch } from './blogIdeasPipeline.js';

let timer = null;
let running = false;

export function startBlogIdeasScheduler() {
  const intervalMin = Number(process.env.BLOG_IDEAS_INTERVAL_MINUTES) || 1440;
  if (intervalMin <= 0) return;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await runBlogIdeasResearch();
      console.log(`blog-ideas: research complete — ${result.added} ideas added from ${result.candidates} candidates`);
    } catch (err) {
      console.error('blog-ideas scheduler:', err.message);
    } finally {
      running = false;
    }
  };

  tick();
  timer = setInterval(tick, intervalMin * 60 * 1000);
  console.log(`blog-ideas scheduler: every ${intervalMin} minutes`);
}

export async function refreshBlogIdeasNow() {
  if (running) {
    const err = new Error('Research already in progress');
    err.code = 'BUSY';
    throw err;
  }
  running = true;
  try {
    return await runBlogIdeasResearch();
  } finally {
    running = false;
  }
}

export function stopBlogIdeasScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
