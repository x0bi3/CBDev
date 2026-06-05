import { Router } from 'express';
import { pool } from '../db.js';
import { sendOrderConfirmation, notifyNewOrder } from '../lib/email.js';

const router = Router();

function orderNumber() {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CB-${ymd}-${rand}`;
}

router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const customerName = String(req.body.customerName || req.body.name || '').trim();
    const addressLine = String(req.body.addressLine || req.body.addr || '').trim();
    const city = String(req.body.city || '').trim();
    const postcode = String(req.body.postcode || req.body.zip || '').trim();
    const items = Array.isArray(req.body.items) ? req.body.items : [];

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Valid email required' });
      return;
    }
    if (!customerName || !addressLine || !city || !postcode) {
      res.status(400).json({ error: 'Complete shipping address required' });
      return;
    }
    if (!items.length) {
      res.status(400).json({ error: 'Cart is empty' });
      return;
    }

    await client.query('BEGIN');

    const lineRows = [];
    let subtotalCents = 0;

    for (const item of items) {
      const slug = String(item.id || item.slug || '').trim();
      const qty = Math.max(1, Math.min(99, Number(item.qty) || 1));
      const variantLabel = String(item.variant || '').trim();
      if (!slug) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'Invalid cart item' });
        return;
      }

      const { rows: products } = await client.query(
        `SELECT slug, name, price_cents, stock_quantity, track_inventory, active
         FROM products WHERE slug = $1 FOR UPDATE`,
        [slug],
      );
      const product = products[0];
      if (!product?.active) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: `Product unavailable: ${slug}` });
        return;
      }
      if (product.track_inventory && (product.stock_quantity ?? 0) < qty) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: `${product.name} is out of stock` });
        return;
      }

      const lineTotal = product.price_cents * qty;
      subtotalCents += lineTotal;
      lineRows.push({
        product_slug: product.slug,
        product_name: product.name,
        variant_label: variantLabel,
        unit_price_cents: product.price_cents,
        quantity: qty,
        line_total_cents: lineTotal,
      });

      if (product.track_inventory) {
        await client.query(
          'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE slug = $2',
          [qty, product.slug],
        );
      }
    }

    const num = orderNumber();
    const { rows: orderRows } = await client.query(
      `INSERT INTO merch_orders (order_number, email, customer_name, address_line, city, postcode, subtotal_cents)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [num, email, customerName, addressLine, city, postcode, subtotalCents],
    );
    const order = orderRows[0];

    const savedItems = [];
    for (const line of lineRows) {
      const { rows } = await client.query(
        `INSERT INTO merch_order_items (order_id, product_slug, product_name, variant_label, unit_price_cents, quantity, line_total_cents)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [order.id, line.product_slug, line.product_name, line.variant_label, line.unit_price_cents, line.quantity, line.line_total_cents],
      );
      savedItems.push(rows[0]);
    }

    await client.query('COMMIT');

    sendOrderConfirmation(order, savedItems).catch(() => {});
    notifyNewOrder(order, savedItems).catch(() => {});

    res.status(201).json({
      order: {
        orderNumber: order.order_number,
        email: order.email,
        total: Math.round(order.subtotal_cents / 100),
      },
    });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    console.error('orders create:', err);
    res.status(500).json({ error: 'Order failed' });
  } finally {
    client.release();
  }
});

export default router;
