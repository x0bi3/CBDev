export class AgentStoppedError extends Error {
  constructor(message = 'Agent stopped') {
    super(message);
    this.name = 'AgentStoppedError';
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createAgentContext({ agent, runId, handle, onStep, onLog, saveDraft, publishPost }) {
  const config = agent.config && typeof agent.config === 'object' ? agent.config : {};

  async function waitWhilePaused() {
    while (handle.paused && !handle.stopped) {
      await new Promise((resolve) => {
        handle.pauseWaiters.push(resolve);
      });
    }
    if (handle.stopped) throw new AgentStoppedError();
  }

  return {
    agentId: agent.id,
    agentSlug: agent.slug,
    runId,
    config,

    async step(step, message) {
      await onStep(step, message);
      await onLog('info', step, message);
      await waitWhilePaused();
    },

    async log(message, level = 'info', step = '') {
      await onLog(level, step, message);
      await waitWhilePaused();
    },

    async checkpoint() {
      await waitWhilePaused();
    },

    async saveDraft(draft) {
      const post = await saveDraft(draft);
      await onLog('info', 'publish', `Draft saved: ${post.slug} (#${post.id})`);
      return post;
    },

    async publishPost(postId) {
      const post = await publishPost(postId);
      await onLog('info', 'publish', `Published: ${post.slug}`);
      return post;
    },

    /** Demo helper — remove or ignore in production scripts */
    async demoDelay(ms = 1200) {
      await sleep(ms);
      await waitWhilePaused();
    },
  };
}
