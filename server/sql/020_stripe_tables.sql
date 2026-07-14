-- Stripe customer mapping
CREATE TABLE IF NOT EXISTS stripe_customers (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_user ON stripe_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_sid ON stripe_customers(stripe_customer_id);

-- Hosting subscriptions
CREATE TABLE IF NOT EXISTS hosting_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  tier TEXT NOT NULL CHECK (tier IN ('starter', 'studio', 'signature')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hosting_subs_user ON hosting_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_hosting_subs_stripe ON hosting_subscriptions(stripe_subscription_id);

-- Add payment columns to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS amount_cents INT DEFAULT 0;

-- Add payment columns to merch_orders
ALTER TABLE merch_orders
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

-- Stripe settings (admin-configurable)
CREATE TABLE IF NOT EXISTS stripe_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  publishable_key TEXT,
  connect_enabled BOOLEAN DEFAULT FALSE,
  blitz_price_cents INT DEFAULT 2000,
  updated_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO stripe_settings (publishable_key) VALUES (NULL) ON CONFLICT DO NOTHING;
