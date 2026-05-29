-- Admin: availability settings, home screen apps, admin role
CREATE TABLE availability_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  timezone TEXT NOT NULL DEFAULT 'America/Chicago',
  weekday_start TIME NOT NULL DEFAULT '09:00',
  weekday_end TIME NOT NULL DEFAULT '17:00',
  slot_interval_minutes INTEGER NOT NULL DEFAULT 30,
  work_weekdays INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  blocked_dates DATE[] NOT NULL DEFAULT '{}'
);

INSERT INTO availability_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE home_apps (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  glyph TEXT NOT NULL DEFAULT '📱',
  tile TEXT NOT NULL DEFAULT 'linear-gradient(135deg,#6366f1,#8b5cf6)',
  screen TEXT NOT NULL DEFAULT 'home' CHECK (screen IN ('home', 'dock')),
  portfolio_slug TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  requires_auth BOOLEAN NOT NULL DEFAULT FALSE,
  assign_users BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO home_apps (app_id, label, glyph, tile, screen, portfolio_slug, sort_order, requires_auth, assign_users) VALUES
  ('merch', 'Merch', '🛍️', 'linear-gradient(135deg,#f43f5e,#7c2d12)', 'home', NULL, 1, FALSE, FALSE),
  ('blog', 'Blog', '✍️', 'linear-gradient(135deg,#fbbf24,#b45309)', 'home', NULL, 2, FALSE, FALSE),
  ('support', 'Support', '🛠️', 'linear-gradient(135deg,#38bdf8,#1e3a8a)', 'home', NULL, 3, FALSE, FALSE),
  ('music', 'Music', '🎧', 'linear-gradient(135deg,#ec4899,#581c87)', 'home', NULL, 4, FALSE, FALSE),
  ('legal', 'Legal', '⚖️', 'linear-gradient(135deg,#94a3b8,#1e293b)', 'home', NULL, 5, FALSE, FALSE),
  ('settings', 'Settings', '⚙️', 'linear-gradient(135deg,#9ca3af,#374151)', 'home', NULL, 6, FALSE, FALSE),
  ('project-a', 'Project A', '🚀', 'linear-gradient(135deg,#22d3ee,#0e7490)', 'home', 'project-a', 7, FALSE, FALSE),
  ('project-b', 'Project B', '🧪', 'linear-gradient(135deg,#a78bfa,#4c1d95)', 'home', 'project-b', 8, FALSE, FALSE),
  ('project-c', 'Project C', '🌿', 'linear-gradient(135deg,#34d399,#065f46)', 'home', 'project-c', 9, FALSE, FALSE),
  ('calendar', 'Calendar', '📅', 'linear-gradient(135deg,#34d399,#0f766e)', 'home', NULL, 10, TRUE, FALSE),
  ('about', 'About', '👤', 'linear-gradient(135deg,#60a5fa,#1e40af)', 'dock', NULL, 1, FALSE, FALSE),
  ('services', 'Services', '🛠️', 'linear-gradient(135deg,#f59e0b,#b45309)', 'dock', NULL, 2, FALSE, FALSE),
  ('portfolio', 'Portfolio', '💼', 'linear-gradient(135deg,#10b981,#065f46)', 'dock', NULL, 3, FALSE, FALSE),
  ('contact', 'Contact', '✉️', 'linear-gradient(135deg,#ec4899,#831843)', 'dock', NULL, 4, FALSE, FALSE)
ON CONFLICT (app_id) DO NOTHING;

-- Admin account (password: change-me-admin — update after first login)
UPDATE users SET role = 'admin' WHERE email = 'demo@creativebuilds.dev';

INSERT INTO users (email, name, password_hash, role) VALUES
  ('admin@creativebuilds.dev', 'Site Admin', '$2a$10$uVcaGL0Ansav.g/vnbQcg.4rf6yzkWsrd0wXdVAkfsq1RhbtaPu3q', 'admin')
ON CONFLICT (email) DO UPDATE SET role = 'admin';
