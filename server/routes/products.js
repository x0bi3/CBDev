import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

function mapCategory(row) {
  return { id: row.slug, label: row.label, icon: row.icon };
}

function mapProduct(row) {
  return {
    id: row.slug,
    name: row.name,
    cat: row.category_slug,
    price: Math.round(row.price_cents / 100),
    color: row.color,
    description: row.description,
    variants: row.variants || {},
    images: row.images || [],
  };
}

router.get('/categories', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT slug, label, icon FROM product_categories ORDER BY sort_order, id`,
    );
    res.json({ categories: rows.map(mapCategory) });
  } catch (err) {
    console.error('products categories:', err);
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

router.get('/', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT slug, name, category_slug, price_cents, description, color, images, variants
       FROM products WHERE active = TRUE ORDER BY sort_order, id`,
    );
    res.json({ products: rows.map(mapProduct) });
  } catch (err) {
    console.error('products list:', err);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT slug, name, category_slug, price_cents, description, color, images, variants
       FROM products WHERE slug = $1 AND active = TRUE`,
      [req.params.slug],
    );
    if (!rows[0]) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json({ product: mapProduct(rows[0]) });
  } catch (err) {
    console.error('products get:', err);
    res.status(500).json({ error: 'Failed to load product' });
  }
});

export default router;
