-- Per-user home/dock app access (inventory, chatbot, etc.)
ALTER TABLE home_apps
  ADD COLUMN IF NOT EXISTS assign_users BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS user_home_apps (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  home_app_id INTEGER NOT NULL REFERENCES home_apps(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, home_app_id)
);

CREATE INDEX IF NOT EXISTS idx_user_home_apps_app ON user_home_apps (home_app_id);

-- Example client-only app (inactive until you enable in admin)
INSERT INTO home_apps (app_id, label, glyph, tile, screen, portfolio_slug, sort_order, requires_auth, assign_users, active)
VALUES (
  'inventory',
  'Inventory',
  '📦',
  'linear-gradient(135deg,#f59e0b,#b45309)',
  'home',
  NULL,
  20,
  TRUE,
  TRUE,
  FALSE
)
ON CONFLICT (app_id) DO UPDATE SET
  requires_auth = TRUE,
  assign_users = TRUE;
