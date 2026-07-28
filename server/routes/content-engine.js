import { Router } from 'express';
import { query } from '../db.js';
import {
  buildSeoPath,
  buildSchemaJson,
  defaultTitle,
  sectionBlueprint,
  wordCountFromPage,
  slugify,
} from '../lib/contentEngine.js';
import { runContentEngineAssist } from '../lib/contentEngineAssist.js';
import {
  listPublishedCaseStudies,
} from '../lib/publishedCaseStudies.js';

const router = Router();

async function getTaxonomy(id) {
  if (!id) return null;
  const { rows } = await query('SELECT * FROM seo_taxonomies WHERE id = $1', [id]);
  return rows[0] || null;
}

async function loadPageBundle(id) {
  const { rows } = await query(
    `SELECT p.*,
      s.slug AS service_slug, s.name AS service_name,
      i.slug AS industry_slug, i.name AS industry_name,
      l.slug AS location_slug, l.name AS location_name
     FROM seo_pages p
     LEFT JOIN seo_taxonomies s ON s.id = p.service_id
     LEFT JOIN seo_taxonomies i ON i.id = p.industry_id
     LEFT JOIN seo_taxonomies l ON l.id = p.location_id
     WHERE p.id = $1`,
    [id],
  );
  if (!rows[0]) return null;
  const { rows: sections } = await query(
    `SELECT * FROM seo_page_sections WHERE page_id = $1 ORDER BY sort_order, id`,
    [id],
  );
  const { rows: links } = await query(
    `SELECT * FROM seo_page_links WHERE page_id = $1 ORDER BY sort_order, id`,
    [id],
  );
  const page = rows[0];
  return {
    page,
    sections,
    links,
    word_count: wordCountFromPage(page, sections),
  };
}

router.get('/taxonomies', async (req, res) => {
  try {
    const kind = req.query.kind ? String(req.query.kind) : null;
    const { rows } = kind
      ? await query(
          `SELECT * FROM seo_taxonomies WHERE active AND kind = $1 ORDER BY sort_order, name`,
          [kind],
        )
      : await query(`SELECT * FROM seo_taxonomies WHERE active ORDER BY kind, sort_order, name`);
    res.json({ taxonomies: rows });
  } catch (err) {
    console.error('ce taxonomies:', err);
    res.status(500).json({ error: 'Failed to load taxonomies' });
  }
});

/** Published /work case studies available to AI Assist (mirrors marketing PORTFOLIO). */
router.get('/case-studies', async (_req, res) => {
  try {
    res.json({ case_studies: listPublishedCaseStudies() });
  } catch (err) {
    console.error('ce case-studies:', err);
    res.status(500).json({ error: 'Failed to load case studies' });
  }
});

router.get('/pages', async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : null;
    const q = req.query.q ? `%${String(req.query.q).trim()}%` : null;
    const params = [];
    const where = [];
    if (status && status !== 'all') {
      params.push(status);
      where.push(`p.status = $${params.length}`);
    }
    if (q) {
      params.push(q);
      where.push(`(p.title ILIKE $${params.length} OR p.path ILIKE $${params.length} OR p.h1 ILIKE $${params.length})`);
    }
    const sql = `
      SELECT p.id, p.title, p.path, p.page_type, p.status, p.published_at, p.updated_at,
             s.name AS service_name, i.name AS industry_name, l.name AS location_name
      FROM seo_pages p
      LEFT JOIN seo_taxonomies s ON s.id = p.service_id
      LEFT JOIN seo_taxonomies i ON i.id = p.industry_id
      LEFT JOIN seo_taxonomies l ON l.id = p.location_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY p.updated_at DESC
      LIMIT 200`;
    const { rows } = await query(sql, params);
    res.json({ pages: rows });
  } catch (err) {
    console.error('ce pages list:', err);
    res.status(500).json({ error: 'Failed to load pages' });
  }
});

router.get('/matrix', async (_req, res) => {
  try {
    const { rows: services } = await query(
      `SELECT * FROM seo_taxonomies WHERE kind = 'service' AND active ORDER BY sort_order`,
    );
    const { rows: industries } = await query(
      `SELECT * FROM seo_taxonomies WHERE kind = 'industry' AND active ORDER BY sort_order`,
    );
    const { rows: locations } = await query(
      `SELECT * FROM seo_taxonomies WHERE kind = 'location' AND active ORDER BY sort_order`,
    );
    const { rows: pages } = await query(
      `SELECT id, path, status, service_id, industry_id, location_id, title FROM seo_pages`,
    );
    res.json({ services, industries, locations, pages });
  } catch (err) {
    console.error('ce matrix:', err);
    res.status(500).json({ error: 'Failed to load matrix' });
  }
});

router.get('/pages/:id', async (req, res) => {
  try {
    const bundle = await loadPageBundle(req.params.id);
    if (!bundle) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(bundle);
  } catch (err) {
    console.error('ce page get:', err);
    res.status(500).json({ error: 'Failed to load page' });
  }
});

router.post('/pages', async (req, res) => {
  try {
    const b = req.body || {};
    const pageType = b.page_type || 'service_industry_location';
    const service = await getTaxonomy(b.service_id);
    const industry = b.industry_id ? await getTaxonomy(b.industry_id) : null;
    const location = await getTaxonomy(b.location_id);

    if (pageType !== 'custom') {
      if (!service || !location) {
        res.status(400).json({ error: 'Service and location required' });
        return;
      }
      if (pageType === 'service_industry_location' && !industry) {
        res.status(400).json({ error: 'Industry required for this page type' });
        return;
      }
    }

    const path =
      b.path ||
      buildSeoPath({
        pageType,
        serviceSlug: service?.slug,
        industrySlug: industry?.slug,
        locationSlug: location?.slug,
        customPath: b.path,
      });

    const title =
      b.title ||
      defaultTitle({
        serviceName: service?.name,
        industryName: industry?.name,
        locationName: location?.name,
        pageType,
      });

    const h1 = b.h1 || title;
    const schemaTypes = b.schema_types || ['ProfessionalService', 'Service', 'FAQPage'];

    const { rows } = await query(
      `INSERT INTO seo_pages (
        title, path, page_type, status, service_id, industry_id, location_id,
        h1, intro, seo_title, seo_description, canonical, robots, og_image_url,
        schema_types, schema_json
      ) VALUES (
        $1,$2,$3,'draft',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb
      ) RETURNING *`,
      [
        title,
        path,
        pageType,
        service?.id || null,
        industry?.id || null,
        location?.id || null,
        h1,
        b.intro || '',
        b.seo_title || `${title} | CreativeBuilds`,
        b.seo_description || '',
        b.canonical || path,
        b.robots || 'index,follow',
        b.og_image_url || '',
        JSON.stringify(schemaTypes),
        JSON.stringify(
          buildSchemaJson({
            schemaTypes,
            title,
            path,
            description: b.seo_description || '',
            serviceName: service?.name,
            locationName: location?.name,
          }),
        ),
      ],
    );

    const page = rows[0];
    const blueprint = sectionBlueprint(pageType);
    for (let i = 0; i < blueprint.length; i++) {
      const sec = blueprint[i];
      await query(
        `INSERT INTO seo_page_sections (page_id, sort_order, section_type, heading, body)
         VALUES ($1,$2,$3,$4,$5)`,
        [page.id, i, sec.section_type, sec.heading, sec.body],
      );
    }

    const bundle = await loadPageBundle(page.id);
    res.status(201).json(bundle);
  } catch (err) {
    console.error('ce page create:', err);
    if (err.code === '23505') {
      res.status(409).json({ error: 'A page with that path already exists' });
      return;
    }
    res.status(500).json({ error: err.message || 'Failed to create page' });
  }
});

router.put('/pages/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const id = req.params.id;
    const schemaTypes = Array.isArray(b.schema_types) ? b.schema_types : undefined;

    const service = b.service_id ? await getTaxonomy(b.service_id) : null;
    const industry = b.industry_id ? await getTaxonomy(b.industry_id) : null;
    const location = b.location_id ? await getTaxonomy(b.location_id) : null;

    let schemaJson = b.schema_json;
    if (schemaTypes) {
      schemaJson = buildSchemaJson({
        schemaTypes,
        title: b.title,
        path: b.path || b.canonical,
        description: b.seo_description,
        serviceName: service?.name || b.service_name,
        locationName: location?.name || b.location_name,
      });
    }

    const { rows } = await query(
      `UPDATE seo_pages SET
        title = COALESCE($1, title),
        path = COALESCE($2, path),
        page_type = COALESCE($3, page_type),
        status = COALESCE($4, status),
        service_id = COALESCE($5, service_id),
        industry_id = COALESCE($6, industry_id),
        location_id = COALESCE($7, location_id),
        h1 = COALESCE($8, h1),
        intro = COALESCE($9, intro),
        seo_title = COALESCE($10, seo_title),
        seo_description = COALESCE($11, seo_description),
        canonical = COALESCE($12, canonical),
        robots = COALESCE($13, robots),
        og_image_url = COALESCE($14, og_image_url),
        schema_types = COALESCE($15::jsonb, schema_types),
        schema_json = COALESCE($16::jsonb, schema_json),
        publish_flags = COALESCE($17::jsonb, publish_flags),
        updated_at = NOW()
       WHERE id = $18 RETURNING *`,
      [
        b.title ?? null,
        b.path ?? null,
        b.page_type ?? null,
        b.status ?? null,
        b.service_id ?? null,
        b.industry_id === undefined ? null : b.industry_id,
        b.location_id ?? null,
        b.h1 ?? null,
        b.intro ?? null,
        b.seo_title ?? null,
        b.seo_description ?? null,
        b.canonical ?? null,
        b.robots ?? null,
        b.og_image_url ?? null,
        schemaTypes ? JSON.stringify(schemaTypes) : null,
        schemaJson ? JSON.stringify(schemaJson) : null,
        b.publish_flags ? JSON.stringify(b.publish_flags) : null,
        id,
      ],
    );
    if (!rows[0]) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    if (Array.isArray(b.sections)) {
      await query('DELETE FROM seo_page_sections WHERE page_id = $1', [id]);
      for (let i = 0; i < b.sections.length; i++) {
        const sec = b.sections[i];
        await query(
          `INSERT INTO seo_page_sections (page_id, sort_order, section_type, heading, body)
           VALUES ($1,$2,$3,$4,$5)`,
          [id, i, sec.section_type || 'body', sec.heading || '', sec.body || ''],
        );
      }
    }

    if (Array.isArray(b.links)) {
      await query('DELETE FROM seo_page_links WHERE page_id = $1', [id]);
      for (let i = 0; i < b.links.length; i++) {
        const link = b.links[i];
        await query(
          `INSERT INTO seo_page_links (page_id, label, target_url, target_page_id, rel, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            id,
            link.label || '',
            link.target_url || null,
            link.target_page_id || null,
            link.rel || 'related',
            i,
          ],
        );
      }
    }

    res.json(await loadPageBundle(id));
  } catch (err) {
    console.error('ce page update:', err);
    if (err.code === '23505') {
      res.status(409).json({ error: 'A page with that path already exists' });
      return;
    }
    res.status(500).json({ error: err.message || 'Failed to update page' });
  }
});

/**
 * AI Assist — Sam → Mark → Cody + stock OG image.
 * Default: return proposal only (UI applies).
 * Body: {
 *   apply?: boolean,
 *   confirm_published?: boolean,
 *   include_case_studies?: boolean,  // default true
 *   case_study_slugs?: string[],     // optional subset; empty = auto-match
 * }
 * Query: ?apply=1 same as body.apply
 */
router.post('/pages/:id/ai-assist', async (req, res) => {
  try {
    const id = req.params.id;
    const bundle = await loadPageBundle(id);
    if (!bundle) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const apply =
      req.query.apply === '1' ||
      req.query.apply === 'true' ||
      !!req.body?.apply;
    const confirmPublished = !!req.body?.confirm_published;
    const caseStudySlugs = Array.isArray(req.body?.case_study_slugs)
      ? req.body.case_study_slugs.map((s) => String(s).trim()).filter(Boolean)
      : [];
    // Include only when Ryan picked one or more from the dropdown
    const includeCaseStudies = caseStudySlugs.length > 0;

    if (apply && bundle.page.status === 'published' && !confirmPublished) {
      res.status(409).json({
        error: 'Page is published. Pass confirm_published: true to overwrite draft fields (status stays published until you unpublish).',
        code: 'CONFIRM_PUBLISHED',
      });
      return;
    }

    const { proposal, rationale, stages } = await runContentEngineAssist(bundle, {
      includeCaseStudies,
      caseStudySlugs,
    });

    if (!apply) {
      res.json({
        proposal,
        rationale,
        stages,
        page_id: Number(id),
        status: bundle.page.status,
      });
      return;
    }

    const updated = await applyProposalToPage(id, bundle, proposal);
    res.json({
      ...updated,
      rationale,
      stages,
      applied: true,
    });
  } catch (err) {
    console.error('ce ai-assist:', err);
    res.status(500).json({ error: err.message || 'AI Assist failed' });
  }
});

async function applyProposalToPage(id, bundle, proposal) {
  const page = bundle.page;
  const schemaTypes = proposal.schema_types || page.schema_types || [];
  const schemaJson =
    proposal.schema_json ||
    buildSchemaJson({
      schemaTypes,
      title: proposal.title,
      path: page.path,
      description: proposal.seo_description,
      serviceName: page.service_name,
      locationName: page.location_name,
    });

  await query(
    `UPDATE seo_pages SET
      title = $1,
      h1 = $2,
      intro = $3,
      seo_title = $4,
      seo_description = $5,
      og_image_url = $6,
      schema_types = $7::jsonb,
      schema_json = $8::jsonb,
      updated_at = NOW()
     WHERE id = $9`,
    [
      proposal.title || page.title,
      proposal.h1 || page.h1,
      proposal.intro ?? '',
      proposal.seo_title || page.seo_title,
      proposal.seo_description || '',
      proposal.og_image_url || page.og_image_url || '',
      JSON.stringify(schemaTypes),
      JSON.stringify(schemaJson),
      id,
    ],
  );

  if (Array.isArray(proposal.sections)) {
    await query('DELETE FROM seo_page_sections WHERE page_id = $1', [id]);
    for (let i = 0; i < proposal.sections.length; i++) {
      const sec = proposal.sections[i];
      await query(
        `INSERT INTO seo_page_sections (page_id, sort_order, section_type, heading, body)
         VALUES ($1,$2,$3,$4,$5)`,
        [id, i, sec.section_type || 'body', sec.heading || '', sec.body || ''],
      );
    }
  }

  if (Array.isArray(proposal.links)) {
    await query('DELETE FROM seo_page_links WHERE page_id = $1', [id]);
    for (let i = 0; i < proposal.links.length; i++) {
      const link = proposal.links[i];
      await query(
        `INSERT INTO seo_page_links (page_id, label, target_url, target_page_id, rel, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, link.label || '', link.target_url || null, null, link.rel || 'related', i],
      );
    }
  }

  return loadPageBundle(id);
}

router.post('/pages/:id/publish', async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE seo_pages SET status = 'published', published_at = COALESCE(published_at, NOW()), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id],
    );
    if (!rows[0]) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(await loadPageBundle(req.params.id));
  } catch (err) {
    console.error('ce publish:', err);
    res.status(500).json({ error: 'Failed to publish' });
  }
});

router.post('/pages/:id/unpublish', async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE seo_pages SET status = 'draft', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id],
    );
    if (!rows[0]) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(await loadPageBundle(req.params.id));
  } catch (err) {
    console.error('ce unpublish:', err);
    res.status(500).json({ error: 'Failed to unpublish' });
  }
});

router.delete('/pages/:id', async (req, res) => {
  await query('DELETE FROM seo_pages WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

router.post('/preview-path', (req, res) => {
  const b = req.body || {};
  const path = buildSeoPath({
    pageType: b.page_type || 'service_industry_location',
    serviceSlug: b.service_slug,
    industrySlug: b.industry_slug,
    locationSlug: b.location_slug,
    customPath: b.path,
  });
  res.json({ path, slugify: slugify(b.service_slug || '') });
});

export default router;
