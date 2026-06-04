-- Remove Calendar from home + Service Center
UPDATE home_apps SET
  active = FALSE,
  auto_install = FALSE,
  store_visible = FALSE
WHERE app_id = 'calendar';

DELETE FROM user_home_apps
WHERE home_app_id = (SELECT id FROM home_apps WHERE app_id = 'calendar');

DELETE FROM user_app_eligibility
WHERE home_app_id = (SELECT id FROM home_apps WHERE app_id = 'calendar');

-- Odysseus: any signed-in user can install from Service Center
UPDATE home_apps SET
  label = 'Odysseus',
  glyph = '🧭',
  assign_users = FALSE,
  requires_auth = TRUE,
  store_visible = TRUE,
  auto_install = FALSE,
  active = TRUE,
  launch_type = 'route',
  launch_url = '/chat'
WHERE app_id = 'chat';
