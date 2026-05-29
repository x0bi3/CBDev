-- Blog writing agents: registry, runs, step logs
CREATE TABLE blog_agents (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  script_module TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  schedule_interval_minutes INTEGER,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  run_state TEXT NOT NULL DEFAULT 'idle'
    CHECK (run_state IN ('idle', 'queued', 'running', 'paused')),
  current_step TEXT NOT NULL DEFAULT '',
  status_message TEXT NOT NULL DEFAULT '',
  active_run_id INTEGER,
  last_run_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE blog_agent_runs (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL REFERENCES blog_agents(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual', 'scheduled')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'paused', 'completed', 'failed', 'stopped')),
  current_step TEXT NOT NULL DEFAULT '',
  status_message TEXT NOT NULL DEFAULT '',
  error_message TEXT,
  result JSONB,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE blog_agent_run_logs (
  id SERIAL PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES blog_agent_runs(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error')),
  step TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_blog_agents_enabled ON blog_agents(enabled);
CREATE INDEX idx_blog_agent_runs_agent ON blog_agent_runs(agent_id, created_at DESC);
CREATE INDEX idx_blog_agent_run_logs_run ON blog_agent_run_logs(run_id, created_at);

INSERT INTO blog_agents (slug, name, description, script_module, enabled, schedule_interval_minutes, config)
VALUES
  (
    'github-sniper',
    'GitHub Sniper',
    'Scans GitHub for trending repos, runs SEO research, drafts posts with links.',
    'github-sniper',
    FALSE,
    1440,
    '{"maxRepos": 5}'::jsonb
  ),
  (
    'youtube-guru',
    'YouTube Guru',
    'Finds how-to videos and transcribes them into how-to blog posts.',
    'youtube-guru',
    FALSE,
    1440,
    '{"maxVideos": 3}'::jsonb
  )
ON CONFLICT (slug) DO NOTHING;
