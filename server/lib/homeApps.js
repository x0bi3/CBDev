/** SQL fragment: home_apps visible for optional user id ($1 = int or null). */
export const HOME_APPS_VISIBILITY = `
  active = TRUE
  AND (
    (NOT requires_auth AND NOT assign_users)
    OR (
      $1::int IS NOT NULL
      AND requires_auth
      AND NOT assign_users
    )
    OR (
      $1::int IS NOT NULL
      AND assign_users
      AND EXISTS (
        SELECT 1 FROM user_home_apps u
        WHERE u.home_app_id = home_apps.id AND u.user_id = $1::int
      )
    )
  )
`;

export function mapHomeAppRow(row) {
  return {
    id: row.app_id,
    label: row.label,
    glyph: row.glyph,
    tile: row.tile,
    portfolioSlug: row.portfolio_slug,
    requiresAuth: row.requires_auth,
    assignUsers: row.assign_users,
  };
}
