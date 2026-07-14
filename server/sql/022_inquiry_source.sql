ALTER TABLE inquiry_submissions
  ADD COLUMN IF NOT EXISTS source TEXT;

CREATE INDEX IF NOT EXISTS idx_inquiry_submissions_source ON inquiry_submissions(source);
