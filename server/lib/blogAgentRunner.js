import { query } from '../db.js';
import { createAgentContext, AgentStoppedError } from './blogAgentContext.js';

const active = new Map();
let schedulerTimer = null;

function slugify(text) {
  return String(text).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'post';
}

async function touchAgent(agentId, patch) {
  const sets = [];
  const vals = [];
  let i = 1;
  for (const [k, v] of Object.entries(patch)) {
    sets.push(`${k} = $${i++}`);
    vals.push(v);
  }
  sets.push(`updated_at = NOW()`);
  vals.push(agentId);
  await query(`UPDATE blog_agents SET ${sets.join(', ')} WHERE id = $${i}`, vals);
}

async function loadAgent(agentId) {
  const { rows } = await query('SELECT * FROM blog_agents WHERE id = $1', [agentId]);
  return rows[0] || null;
}

export function isAgentActive(agentId) {
  return active.has(agentId);
}

export async function startAgentRun(agentId, trigger = 'manual') {
  if (active.has(agentId)) {
    const err = new Error('Agent is already running');
    err.code = 'ALREADY_RUNNING';
    throw err;
  }

  const agent = await loadAgent(agentId);
  if (!agent) {
    const err = new Error('Agent not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const { rows: runRows } = await query(
    `INSERT INTO blog_agent_runs (agent_id, trigger, status, status_message)
     VALUES ($1, $2, 'queued', 'Queued…') RETURNING id`,
    [agentId, trigger],
  );
  const runId = runRows[0].id;

  const handle = {
    runId,
    agentId,
    paused: false,
    stopped: false,
    pauseWaiters: [],
  };
  active.set(agentId, handle);

  await touchAgent(agentId, {
    run_state: 'queued',
    current_step: '',
    status_message: 'Queued…',
    active_run_id: runId,
    last_error: null,
  });

  runAgentJob(agent, runId, handle).catch((err) => {
    console.error(`blog-agent ${agent.slug} crashed:`, err);
  });

  return { runId };
}

async function runAgentJob(agent, runId, handle) {
  const startedAt = new Date().toISOString();

  await query(
    `UPDATE blog_agent_runs SET status = 'running', started_at = $2, status_message = 'Starting…' WHERE id = $1`,
    [runId, startedAt],
  );
  await touchAgent(agent.id, {
    run_state: 'running',
    status_message: 'Starting…',
    current_step: 'init',
  });

  const ctx = createAgentContext({
    agent,
    runId,
    handle,
    onStep: async (step, message) => {
      await query(
        `UPDATE blog_agent_runs SET current_step = $2, status_message = $3 WHERE id = $1`,
        [runId, step, message],
      );
      await touchAgent(agent.id, {
        run_state: handle.paused ? 'paused' : 'running',
        current_step: step,
        status_message: message,
      });
    },
    onLog: async (level, step, message) => {
      await query(
        `INSERT INTO blog_agent_run_logs (run_id, level, step, message) VALUES ($1, $2, $3, $4)`,
        [runId, level, step || '', message],
      );
    },
    saveDraft: async (draft) => {
      const slug = draft.slug || slugify(draft.title);
      const { rows } = await query(
        `INSERT INTO blog_posts (slug, title, excerpt, body, read_time, status, published_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7) RETURNING id, slug, title, status`,
        [
          slug,
          draft.title,
          draft.excerpt || '',
          JSON.stringify(draft.body || []),
          draft.read_time || '5 min',
          draft.status || 'draft',
          draft.published_at || null,
        ],
      );
      return rows[0];
    },
    publishPost: async (postId) => {
      const { rows } = await query(
        `UPDATE blog_posts SET status = 'published', published_at = COALESCE(published_at, NOW())
         WHERE id = $1 RETURNING id, slug, title, status, published_at`,
        [postId],
      );
      return rows[0];
    },
  });

  let finalStatus = 'completed';
  let errorMessage = null;
  let result = null;

  try {
    const mod = await import(`../agents/${agent.script_module}.js`);
    if (typeof mod.default !== 'function') {
      throw new Error(`Agent module "${agent.script_module}" must export default async function`);
    }
    result = await mod.default(ctx);
    if (handle.stopped) finalStatus = 'stopped';
  } catch (err) {
    if (err instanceof AgentStoppedError || handle.stopped) {
      finalStatus = 'stopped';
      errorMessage = err.message || 'Stopped by admin';
    } else {
      finalStatus = 'failed';
      errorMessage = err.message || String(err);
      console.error(`blog-agent ${agent.slug}:`, err);
    }
  } finally {
    active.delete(agent.id);

    const finishedAt = new Date().toISOString();
    await query(
      `UPDATE blog_agent_runs SET status = $2, error_message = $3, result = $4::jsonb,
        finished_at = $5, status_message = $6 WHERE id = $1`,
      [
        runId,
        finalStatus,
        errorMessage,
        result ? JSON.stringify(result) : null,
        finishedAt,
        finalStatus === 'completed' ? 'Finished' : (errorMessage || 'Stopped'),
      ],
    );
    await touchAgent(agent.id, {
      run_state: 'idle',
      current_step: '',
      status_message: finalStatus === 'completed' ? 'Last run completed' : (errorMessage || 'Stopped'),
      active_run_id: null,
      last_run_at: startedAt,
      last_error: finalStatus === 'failed' ? errorMessage : null,
    });
  }

  return { runId, status: finalStatus };
}

export function pauseAgent(agentId) {
  const handle = active.get(agentId);
  if (!handle) return false;
  handle.paused = true;
  touchAgent(agentId, { run_state: 'paused' }).catch(console.error);
  query(
    `UPDATE blog_agent_runs SET status = 'paused' WHERE id = $1`,
    [handle.runId],
  ).catch(console.error);
  return true;
}

export function resumeAgent(agentId) {
  const handle = active.get(agentId);
  if (!handle) return false;
  handle.paused = false;
  touchAgent(agentId, { run_state: 'running' }).catch(console.error);
  query(
    `UPDATE blog_agent_runs SET status = 'running' WHERE id = $1`,
    [handle.runId],
  ).catch(console.error);
  for (const resolve of handle.pauseWaiters.splice(0)) resolve();
  return true;
}

export function stopAgent(agentId) {
  const handle = active.get(agentId);
  if (!handle) return false;
  handle.stopped = true;
  handle.paused = false;
  for (const resolve of handle.pauseWaiters.splice(0)) resolve();
  return true;
}

export async function tickScheduledAgents() {
  const { rows } = await query(`
    SELECT id, slug, schedule_interval_minutes, last_run_at
    FROM blog_agents
    WHERE enabled = TRUE
      AND schedule_interval_minutes IS NOT NULL
      AND schedule_interval_minutes > 0
      AND run_state = 'idle'
      AND (
        last_run_at IS NULL
        OR last_run_at + (schedule_interval_minutes * INTERVAL '1 minute') < NOW()
      )
  `);

  for (const agent of rows) {
    if (active.has(agent.id)) continue;
    try {
      console.log(`blog-agent scheduler: starting ${agent.slug}`);
      await startAgentRun(agent.id, 'scheduled');
    } catch (err) {
      if (err.code !== 'ALREADY_RUNNING') {
        console.error(`blog-agent scheduler ${agent.slug}:`, err);
      }
    }
  }
}

export function startBlogAgentScheduler() {
  if (schedulerTimer) return;
  tickScheduledAgents().catch(console.error);
  schedulerTimer = setInterval(() => {
    tickScheduledAgents().catch(console.error);
  }, 60_000);
  console.log('blog-agent scheduler: every 60s');
}
