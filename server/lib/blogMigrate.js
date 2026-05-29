import { query } from '../db.js';
import { blocksToHtml } from './blogHtml.js';

/** One-time migration: populate body_html from legacy body JSONB arrays */
export async function migrateBlogBodyToHtml() {
  const { rows } = await query(
    `SELECT id, body FROM blog_posts WHERE (body_html IS NULL OR body_html = '') AND body IS NOT NULL AND body::text != '[]'`,
  );

  for (const row of rows) {
    const html = blocksToHtml(row.body);
    if (html) {
      await query('UPDATE blog_posts SET body_html = $1 WHERE id = $2', [html, row.id]);
    }
  }

  if (rows.length > 0) {
    console.log(`blog-migrate: converted ${rows.length} posts to body_html`);
  }
}
