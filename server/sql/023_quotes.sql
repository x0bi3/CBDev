-- Quotes: admin-built pricing quotes, emailed to clients, paid via Stripe deposit.
CREATE TABLE IF NOT EXISTS quotes (
  id SERIAL PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  client_name TEXT,
  client_email TEXT NOT NULL,
  company TEXT,
  category TEXT,
  tier TEXT,
  line_items JSONB NOT NULL DEFAULT '[]',
  answers JSONB NOT NULL DEFAULT '{}',
  notes JSONB NOT NULL DEFAULT '{}',
  subtotal_cents INT NOT NULL DEFAULT 0,
  deposit_cents INT NOT NULL DEFAULT 0,
  total_cents INT NOT NULL DEFAULT 0,
  deposit_pct INT NOT NULL DEFAULT 25,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid')),
  inquiry_id INT REFERENCES inquiry_submissions(id) ON DELETE SET NULL,
  stripe_session_id TEXT,
  paid_at TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_public ON quotes(public_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created ON quotes(created_at DESC);
