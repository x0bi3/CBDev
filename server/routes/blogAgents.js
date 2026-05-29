import { Router } from 'express';
import { query } from '../db.js';
import { requireAdmin } from '../auth.js';
import {
  startAgentRun,
  pauseAgent,
  resumeAgent,
  stopAgent,
  isAgentActive,
} from '../lib/blogAgentRunner.js';

const router = Router();
router.use(requireAdmin);

function mapAgent(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    script_module: row.script_module,
    enabled: row.enabled,
    schedule_interval_minutes: row.schedule_interval_minutes,
    config: row.config || {},
    run_state: row.run_state,
    current_step: row.current_step,
    status_message: row.status_message,
    active_run_id: row.active_run_id,
    last_run_at: row.last_run_at,
    last_error: row.last_error,
    is_active: isAgentActive(row.id),
    updated_at: row.updated_at,
  };
}

router.get('/', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM blog_agents ORDER BY name`,
    );
    res.json({ agents: rows.map(mapAgent) });
  } catch (err) {
    console.error('blog-agents list:', err);
    res.status(500).json({ error: 'Failed to load agents' });
  }
});

router.get('/:id/runs', async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const { rows } = await query(
      `SELECT id, agent_id, trigger, status, current_step, status_message, error_message,
              result, started_at, finished_at, created_at
       FROM blog_agent_runs WHERE agent_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [req.params.id, limit],
    );
    res.json({ runs: rows });
  } catch (err) {
    console.error('blog-agents runs:', err);
    res.status(500).json({ error: 'Failed to load runs' });
  }
});

router.get('/:id/logs', async (req, res) => {
  try {
    const runId = req.query.run_id;
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
    let rows;
    if (runId) {
      ({ rows } = await query(
        `SELECT l.id, l.run_id, l.level, l.step, l.message, l.created_at
         FROM blog_agent_run_logs l
         JOIN blog_agent_runs r ON r.id = l.run_id
         WHERE r.agent_id = $1 AND l.run_id = $2
         ORDER BY l.created_at ASC LIMIT $3`,
        [req.params.id, runId, limit],
      ));
    } else {
      ({ rows } = await query(
        `SELECT l.id, l.run_id, l.level, l.step, l.message, l.created_at
         FROM blog_agent_run_logs l
         JOIN blog_agent_runs r ON r.id = l.run_id
         WHERE r.agent_id = $1
         ORDER BY l.created_at DESC LIMIT $2`,
        [req.params.id, limit],
      ));
      rows.reverse();
    }
    res.json({ logs: rows });
  } catch (err) {
    console.error('blog-agents logs:', err);
    res.status(500).json({ error: 'Failed to load logs' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const b = req.body;
    const { rows } = await query(
      `UPDATE blog_agents SET
        enabled = COALESCE($2, enabled),
        schedule_interval_minutes = $3,
        config = COALESCE($4::jsonb, config),
        updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        req.params.id,
        b.enabled,
        b.schedule_interval_minutes === '' || b.schedule_interval_minutes == null
          ? null
          : Math.max(0, Number(b.schedule_interval_minutes)),
        b.config != null ? JSON.stringify(b.config) : null,
      ],
    );
    if (!rows[0]) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    res.json({ agent: mapAgent(rows[0]) });
  } catch (err) {
    console.error('blog-agents update:', err);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

router.post('/:id/start', async (req, res) => {
  try {
    const { runId } = await startAgentRun(Number(req.params.id), 'manual');
    const { rows } = await query('SELECT * FROM blog_agents WHERE id = $1', [req.params.id]);
    res.json({ ok: true, runId, agent: rows[0] ? mapAgent(rows[0]) : null });
  } catch (err) {
    if (err.code === 'ALREADY_RUNNING') {
      res.status(409).json({ error: 'Agent is already running' });
      return;
    }
    if (err.code === 'NOT_FOUND') {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    console.error('blog-agents start:', err);
    res.status(500).json({ error: err.message || 'Failed to start agent' });
  }
});

router.post('/:id/pause', async (req, res) => {
  const ok = pauseAgent(Number(req.params.id));
  if (!ok) {
    res.status(409).json({ error: 'Agent is not running' });
    return;
  }
  const { rows } = await query('SELECT * FROM blog_agents WHERE id = $1', [req.params.id]);
  res.json({ ok: true, agent: rows[0] ? mapAgent(rows[0]) : null });
});

router.post('/:id/resume', async (req, res) => {
  const ok = resumeAgent(Number(req.params.id));
  if (!ok) {
    res.status(409).json({ error: 'Agent is not paused' });
    return;
  }
  const { rows } = await query('SELECT * FROM blog_agents WHERE id = $1', [req.params.id]);
  res.json({ ok: true, agent: rows[0] ? mapAgent(rows[0]) : null });
});

router.post('/:id/stop', async (req, res) => {
  const ok = stopAgent(Number(req.params.id));
  if (!ok) {
    res.status(409).json({ error: 'Agent is not running' });
    return;
  }
  res.json({ ok: true, message: 'Stop requested' });
});

router.delete('/:id', async (req, res) => {
  try {
    const agentId = Number(req.params.id);
    if (isAgentActive(agentId)) {
      res.status(409).json({ error: 'Stop the agent before deleting it' });
      return;
    }

    const { rows } = await query(
      'DELETE FROM blog_agents WHERE id = $1 RETURNING id, slug, name',
      [agentId],
    );
    if (!rows[0]) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    res.json({ ok: true, deleted: rows[0] });
  } catch (err) {
    console.error('blog-agents delete:', err);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

export default router;
