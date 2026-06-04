-- App Store: launch types, store visibility, user install vs eligibility
ALTER TABLE home_apps
  ADD COLUMN IF NOT EXISTS launch_type TEXT NOT NULL DEFAULT 'embedded',
  ADD COLUMN IF NOT EXISTS launch_url TEXT,
  ADD COLUMN IF NOT EXISTS store_visible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS auto_install BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE home_apps DROP CONSTRAINT IF EXISTS home_apps_launch_type_check;
ALTER TABLE home_apps ADD CONSTRAINT home_apps_launch_type_check
  CHECK (launch_type IN ('embedded', 'route', 'external'));

CREATE INDEX IF NOT EXISTS idx_user_home_apps_user ON user_home_apps (user_id);

-- Admin-granted store eligibility (separate from user install on home screen)
CREATE TABLE IF NOT EXISTS user_app_eligibility (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  home_app_id INTEGER NOT NULL REFERENCES home_apps(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, home_app_id)
);

CREATE INDEX IF NOT EXISTS idx_user_app_eligibility_user ON user_app_eligibility (user_id);

-- Existing assignments count as both eligible and installed
INSERT INTO user_app_eligibility (user_id, home_app_id)
SELECT user_id, home_app_id FROM user_home_apps
ON CONFLICT DO NOTHING;

-- Calendar: auto-install for all signed-in users (existing behavior)
UPDATE home_apps SET auto_install = TRUE, launch_type = 'embedded'
WHERE app_id = 'calendar';

-- Chat: route app, store-eligible via admin assignment
INSERT INTO home_apps (
  app_id, label, glyph, tile, screen, portfolio_slug, sort_order,
  requires_auth, assign_users, active, launch_type, launch_url, store_visible, auto_install
) VALUES (
  'chat',
  'Chat',
  '💬',
  'linear-gradient(135deg,#6366f1,#4338ca)',
  'home',
  NULL,
  15,
  TRUE,
  TRUE,
  TRUE,
  'route',
  '/chat',
  TRUE,
  FALSE
)
ON CONFLICT (app_id) DO UPDATE SET
  label = EXCLUDED.label,
  glyph = EXCLUDED.glyph,
  tile = EXCLUDED.tile,
  launch_type = EXCLUDED.launch_type,
  launch_url = EXCLUDED.launch_url,
  store_visible = EXCLUDED.store_visible,
  requires_auth = TRUE,
  assign_users = TRUE,
  active = TRUE;

-- App Store itself: visible to all signed-in users, auto-install on home
INSERT INTO home_apps (
  app_id, label, glyph, tile, screen, portfolio_slug, sort_order,
  requires_auth, assign_users, active, launch_type, launch_url, store_visible, auto_install
) VALUES (
  'app-store',
  'App Store',
  '🛒',
  'linear-gradient(135deg,#0ea5e9,#2563eb)',
  'home',
  NULL,
  5,
  TRUE,
  FALSE,
  TRUE,
  'embedded',
  NULL,
  FALSE,
  TRUE
)
ON CONFLICT (app_id) DO UPDATE SET
  label = EXCLUDED.label,
  glyph = EXCLUDED.glyph,
  tile = EXCLUDED.tile,
  launch_type = 'embedded',
  store_visible = FALSE,
  auto_install = TRUE,
  requires_auth = TRUE,
  assign_users = FALSE,
  active = TRUE;

-- Inventory: store-eligible only (assignment = eligibility, not auto home icon)
UPDATE home_apps SET
  assign_users = TRUE,
  requires_auth = TRUE,
  store_visible = TRUE,
  auto_install = FALSE,
  launch_type = 'embedded'
WHERE app_id = 'inventory';

-- GitHub uses external launch
UPDATE home_apps SET launch_type = 'external', launch_url = 'https://github.com'
WHERE app_id = 'github';
