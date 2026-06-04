-- Service Center rebrand + catalog polish
UPDATE home_apps SET
  label = 'Service Center',
  glyph = '🛠️'
WHERE app_id = 'app-store';

UPDATE home_apps SET
  label = 'Odysseus',
  glyph = '🧭',
  launch_type = 'route',
  launch_url = '/chat',
  store_visible = TRUE,
  active = TRUE
WHERE app_id = 'chat';

-- Hide Calendar from Service Center until app pipeline is ready
UPDATE home_apps SET store_visible = FALSE
WHERE app_id = 'calendar';
