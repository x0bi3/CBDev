-- Free Service Audits: automated website reports + waitlists + CTA attribution

CREATE TABLE IF NOT EXISTS free_audit_reports (
  id SERIAL PRIMARY KEY,
  public_token TEXT NOT NULL UNIQUE,
  inquiry_id INT REFERENCES inquiry_submissions(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'ready', 'failed')),
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  sections JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ready_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_free_audit_reports_token ON free_audit_reports(public_token);
CREATE INDEX IF NOT EXISTS idx_free_audit_reports_email ON free_audit_reports(email);
CREATE INDEX IF NOT EXISTS idx_free_audit_reports_status ON free_audit_reports(status);
CREATE INDEX IF NOT EXISTS idx_free_audit_reports_created ON free_audit_reports(created_at DESC);

CREATE TABLE IF NOT EXISTS free_audit_waitlist (
  id SERIAL PRIMARY KEY,
  service_slug TEXT NOT NULL,
  name TEXT,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_free_audit_waitlist_service ON free_audit_waitlist(service_slug);
CREATE INDEX IF NOT EXISTS idx_free_audit_waitlist_email ON free_audit_waitlist(email);

CREATE TABLE IF NOT EXISTS free_audit_cta_events (
  id SERIAL PRIMARY KEY,
  report_id INT NOT NULL REFERENCES free_audit_reports(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  destination TEXT NOT NULL DEFAULT 'inquiry',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_free_audit_cta_report ON free_audit_cta_events(report_id);
CREATE INDEX IF NOT EXISTS idx_free_audit_cta_section ON free_audit_cta_events(section);
