-- Move Support to dock (Portfolio slot), hide Portfolio app, keep Legal on home for page-2 pin in client
UPDATE home_apps SET screen = 'dock', sort_order = 3 WHERE app_id = 'support';
UPDATE home_apps SET active = FALSE WHERE app_id = 'portfolio';
