/** SQL fragment: home screen apps for optional user id ($1 = int or null). */
export const HOME_APPS_VISIBILITY = `
  active = TRUE
  AND (
    (NOT requires_auth AND NOT assign_users AND NOT auto_install)
    OR ($1::int IS NOT NULL AND auto_install = TRUE)
    OR (
      $1::int IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM user_home_apps u
        WHERE u.home_app_id = home_apps.id AND u.user_id = $1::int
      )
    )
  )
`;

/** Store catalog: auth-only apps + assign_users apps user is eligible for. Use table alias `h`. */
export const STORE_CATALOG_WHERE = `
  h.active = TRUE
  AND h.store_visible = TRUE
  AND h.app_id NOT IN ('app-store', 'calendar')
  AND (
    (h.requires_auth AND NOT h.assign_users)
    OR (
      h.assign_users
      AND EXISTS (
        SELECT 1 FROM user_app_eligibility e
        WHERE e.home_app_id = h.id AND e.user_id = $1::int
      )
    )
  )
`;

const APP_SELECT = `
  app_id, label, glyph, tile, screen, portfolio_slug, sort_order,
  requires_auth, assign_users, launch_type, launch_url, auto_install
`;

/** Home apps list — pass user id as $1 for user_installed flag. */
export const HOME_APP_SELECT = `
  ${APP_SELECT},
  (
    $1::int IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM user_home_apps u
      WHERE u.home_app_id = home_apps.id AND u.user_id = $1::int
    )
  ) AS user_installed
`;

export { APP_SELECT };

export function mapHomeAppRow(row) {
  return {
    id: row.app_id,
    label: row.label,
    glyph: row.glyph,
    tile: row.tile,
    portfolioSlug: row.portfolio_slug,
    requiresAuth: row.requires_auth,
    assignUsers: row.assign_users,
    launchType: row.launch_type || 'embedded',
    launchUrl: row.launch_url || null,
    autoInstall: !!row.auto_install,
    userInstalled: !!row.user_installed,
  };
}

export function mapStoreAppRow(row) {
  return {
    ...mapHomeAppRow(row),
    installed: !!row.installed,
  };
}
