-- Calendar icon on home grid (visible to signed-in users only)
ALTER TABLE home_apps
  ADD COLUMN IF NOT EXISTS requires_auth BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO home_apps (app_id, label, glyph, tile, screen, portfolio_slug, sort_order, requires_auth)
VALUES (
  'calendar',
  'Calendar',
  '📅',
  'linear-gradient(135deg,#34d399,#0f766e)',
  'home',
  NULL,
  10,
  TRUE
)
ON CONFLICT (app_id) DO UPDATE SET
  label = EXCLUDED.label,
  glyph = EXCLUDED.glyph,
  tile = EXCLUDED.tile,
  screen = EXCLUDED.screen,
  sort_order = EXCLUDED.sort_order,
  requires_auth = TRUE,
  active = TRUE;
