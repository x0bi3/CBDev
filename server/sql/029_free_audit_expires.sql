-- Free audit report expiry (24h from ready)

ALTER TABLE free_audit_reports
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_free_audit_reports_expires ON free_audit_reports(expires_at)
  WHERE expires_at IS NOT NULL;
