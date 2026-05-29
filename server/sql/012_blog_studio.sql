-- AI Blog Writing Studio: drop agents, add body_html + blog_ideas

DROP TABLE IF EXISTS blog_agent_run_logs;
DROP TABLE IF EXISTS blog_agent_runs;
DROP TABLE IF EXISTS blog_agents;

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS body_html TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS blog_ideas (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  angle TEXT NOT NULL DEFAULT '',
  rationale TEXT NOT NULL DEFAULT '',
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  score NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'suggested'
    CHECK (status IN ('suggested', 'used', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_blog_ideas_status ON blog_ideas(status, score DESC);
