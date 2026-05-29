-- Calendar / scheduling (run after 001_schema.sql)
CREATE TABLE meeting_types (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  description TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meeting_type_slug TEXT NOT NULL REFERENCES meeting_types(slug),
  starts_at TIMESTAMPTZ NOT NULL UNIQUE,
  ends_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_starts ON bookings(starts_at);

INSERT INTO meeting_types (slug, label, duration_minutes, description, sort_order) VALUES
  ('call', 'Discovery call', 30, 'A quick video or phone call to talk through your idea, timeline, and fit.', 1),
  ('meeting', 'Project meeting', 60, 'A longer working session for scoping, review, or planning the next build phase.', 2)
ON CONFLICT (slug) DO NOTHING;
