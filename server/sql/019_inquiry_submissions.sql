CREATE TABLE IF NOT EXISTS inquiry_submissions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  categories JSONB NOT NULL DEFAULT '[]',
  overview TEXT NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  budget TEXT,
  timeline TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inquiry_submissions_status ON inquiry_submissions(status);
CREATE INDEX IF NOT EXISTS idx_inquiry_submissions_created ON inquiry_submissions(created_at DESC);
