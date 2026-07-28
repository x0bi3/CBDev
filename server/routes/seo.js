import { Router } from 'express';
import { query } from '../db.js';
import { wordCountFromPage } from '../lib/contentEngine.js';

const router = Router();

function normalizePath(raw) {
  let p = String(raw || '').trim();
  if (!p) return '';
  if (!p.startsWith('/')) p = `/${p}`;
  // strip trailing slash except root
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

async function loadPublishedByPath(path) {
  const { rows } = await query(
    `SELECT p.*,
      s.slug AS service_slug, s.name AS service_name,
      i.slug AS industry_slug, i.name AS industry_name,
      l.slug AS location_slug, l.name AS location_name
     FROM seo_pages p
     LEFT JOIN seo_taxonomies s ON s.id = p.service_id
     LEFT JOIN seo_taxonomies i ON i.id = p.industry_id
     LEFT JOIN seo_taxonomies l ON l.id = p.location_id
     WHERE p.path = $1 AND p.status = 'published'`,
    [path],
  );
  if (!rows[0]) return null;
  const page = rows[0];
  const { rows: sections } = await query(
    `SELECT id, sort_order, section_type, heading, body FROM seo_page_sections
     WHERE page_id = $1 ORDER BY sort_order, id`,
    [page.id],
  );
  const { rows: links } = await query(
    `SELECT id, label, target_url, target_page_id, rel, sort_order FROM seo_page_links
     WHERE page_id = $1 ORDER BY sort_order, id`,
    [page.id],
  );
  return {
    page: {
      id: page.id,
      title: page.title,
      path: page.path,
      page_type: page.page_type,
      h1: page.h1,
      intro: page.intro,
      seo_title: page.seo_title,
      seo_description: page.seo_description,
      canonical: page.canonical || page.path,
      robots: page.robots,
      og_image_url: page.og_image_url,
      schema_json: page.schema_json,
      published_at: page.published_at,
      service_slug: page.service_slug,
      service_name: page.service_name,
      industry_slug: page.industry_slug,
      industry_name: page.industry_name,
      location_slug: page.location_slug,
      location_name: page.location_name,
    },
    sections,
    links,
    word_count: wordCountFromPage(page, sections),
  };
}

router.get('/pages', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT path, title, seo_title, published_at, updated_at
       FROM seo_pages WHERE status = 'published'
       ORDER BY published_at DESC NULLS LAST, id DESC`,
    );
    res.json({ pages: rows });
  } catch (err) {
    console.error('seo list:', err);
    res.status(500).json({ error: 'Failed to list SEO pages' });
  }
});

router.get('/page', async (req, res) => {
  try {
    const path = normalizePath(req.query.path);
    if (!path) {
      res.status(400).json({ error: 'path query required' });
      return;
    }
    const bundle = await loadPublishedByPath(path);
    if (!bundle) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(bundle);
  } catch (err) {
    console.error('seo page:', err);
    res.status(500).json({ error: 'Failed to load page' });
  }
});

export default router;
