import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

function mapProject(row) {
  return {
    id: row.slug,
    name: row.name,
    tag: row.tag,
    color: row.color,
    role: row.role,
    year: row.year,
    stack: row.stack,
    summary: row.summary,
    highlights: row.highlights || [],
  };
}

router.get('/', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT slug, name, tag, color, role, year, stack, summary, highlights
       FROM portfolio_projects WHERE active = TRUE ORDER BY sort_order, id`,
    );
    res.json({ projects: rows.map(mapProject) });
  } catch (err) {
    console.error('portfolio list:', err);
    res.status(500).json({ error: 'Failed to load portfolio' });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT slug, name, tag, color, role, year, stack, summary, highlights
       FROM portfolio_projects WHERE slug = $1 AND active = TRUE`,
      [req.params.slug],
    );
    if (!rows[0]) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json({ project: mapProject(rows[0]) });
  } catch (err) {
    console.error('portfolio get:', err);
    res.status(500).json({ error: 'Failed to load project' });
  }
});

export default router;
