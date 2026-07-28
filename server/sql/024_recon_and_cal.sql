-- Cal follow-up booking id on inquiries + presence audit reports (Ryker)

ALTER TABLE inquiry_submissions
  ADD COLUMN IF NOT EXISTS cal_booking_uid TEXT;

CREATE INDEX IF NOT EXISTS idx_inquiry_cal_booking
  ON inquiry_submissions(cal_booking_uid)
  WHERE cal_booking_uid IS NOT NULL;

CREATE TABLE IF NOT EXISTS recon_reports (
  id SERIAL PRIMARY KEY,
  lead_email TEXT NOT NULL,
  lead_name TEXT,
  source TEXT NOT NULL,
  inquiry_id INT REFERENCES inquiry_submissions(id) ON DELETE SET NULL,
  cal_booking_uid TEXT,
  domain TEXT,
  url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  summary TEXT,
  report_md TEXT,
  findings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recon_email ON recon_reports(lead_email);
CREATE INDEX IF NOT EXISTS idx_recon_inquiry ON recon_reports(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_recon_created ON recon_reports(created_at DESC);
