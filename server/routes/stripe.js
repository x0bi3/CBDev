import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { getStripe, getOrCreateCustomer, HOSTING_PRICES, BLITZ_PRICE_CENTS, stripeConfigured } from '../lib/stripe.js';
import { notifyNewInquiry } from '../lib/email.js';

const router = Router();

const baseUrl = () => process.env.APP_URL || process.env.STUDIO_URL || 'https://app.creativebuilds.dev';

router.get('/config', (_req, res) => {
  if (!stripeConfigured()) {
    res.json({ configured: false });
    return;
  }
  res.json({
    configured: true,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
  });
});

router.post('/checkout/blitz', requireAuth, async (req, res) => {
  try {
    const stripe = getStripe();
    const { rows: userRows } = await query('SELECT email, display_name FROM users WHERE id = $1', [req.userId]);
    const user = userRows[0];
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const startsAt = String(req.body.startsAt || '').trim();
    const notes = req.body.notes ? String(req.body.notes).trim() : '';

    if (!startsAt) { res.status(400).json({ error: 'Start time required' }); return; }

    const customerId = await getOrCreateCustomer(req.userId, user.email, user.display_name);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'Blitz Call (30 min)', description: 'Live screenshare with a developer. Troubleshoot, brainstorm, get unstuck.' },
          unit_amount: BLITZ_PRICE_CENTS,
        },
        quantity: 1,
      }],
      metadata: { type: 'blitz_call', user_id: String(req.userId), starts_at: startsAt, notes },
      success_url: `${baseUrl()}/calendar?session_id={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url: `${baseUrl()}/calendar?status=cancelled`,
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('stripe blitz checkout:', err);
    res.status(500).json({ error: 'Checkout failed' });
  }
});

router.post('/checkout/order', async (req, res) => {
  try {
    const stripe = getStripe();
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const email = String(req.body.email || '').trim();

    if (!items.length) { res.status(400).json({ error: 'Cart is empty' }); return; }
    if (!email) { res.status(400).json({ error: 'Email required' }); return; }

    const lineItems = [];
    for (const item of items) {
      const slug = String(item.id || item.slug || '').trim();
      const qty = Math.max(1, Math.min(99, Number(item.qty) || 1));
      if (!slug) continue;

      const { rows } = await query(
        'SELECT name, price_cents, active FROM products WHERE slug = $1',
        [slug],
      );
      const product = rows[0];
      if (!product?.active) continue;

      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: product.name },
          unit_amount: product.price_cents,
        },
        quantity: qty,
      });
    }

    if (!lineItems.length) { res.status(400).json({ error: 'No valid items' }); return; }

    const session = await stripe.checkout.sessions.create({
      customer_email: email,
      mode: 'payment',
      line_items: lineItems,
      shipping_address_collection: { allowed_countries: ['US'] },
      metadata: { type: 'merch_order', email, item_slugs: items.map((i) => i.id || i.slug).join(',') },
      success_url: `${baseUrl()}/store?session_id={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url: `${baseUrl()}/store?status=cancelled`,
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('stripe order checkout:', err);
    res.status(500).json({ error: 'Checkout failed' });
  }
});

router.post('/checkout/hosting', requireAuth, async (req, res) => {
  try {
    const stripe = getStripe();
    const tier = String(req.body.tier || '').trim();
    const cycle = String(req.body.cycle || 'monthly').trim();

    if (!HOSTING_PRICES[tier]) { res.status(400).json({ error: 'Invalid tier' }); return; }
    if (cycle !== 'monthly' && cycle !== 'yearly') { res.status(400).json({ error: 'Invalid cycle' }); return; }

    const { rows: userRows } = await query('SELECT email, display_name FROM users WHERE id = $1', [req.userId]);
    const user = userRows[0];
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const customerId = await getOrCreateCustomer(req.userId, user.email, user.display_name);
    const priceAmount = cycle === 'yearly' ? HOSTING_PRICES[tier].yearly : HOSTING_PRICES[tier].monthly;
    const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `CreativeBuilds ${tierLabel} Hosting` },
          unit_amount: priceAmount,
          recurring: { interval: cycle === 'yearly' ? 'year' : 'month' },
        },
        quantity: 1,
      }],
      metadata: { type: 'hosting_subscription', user_id: String(req.userId), tier, cycle },
      success_url: `${baseUrl()}/settings?session_id={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url: `${baseUrl()}/settings?status=cancelled`,
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('stripe hosting checkout:', err);
    res.status(500).json({ error: 'Checkout failed' });
  }
});

router.post('/webhook', async (req, res) => {
  const stripe = getStripe();
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (endpointSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      event = req.body;
    }
  } catch (err) {
    console.error('stripe webhook sig verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  const type = event.type;
  const data = event.data?.object;

  try {
    if (type === 'checkout.session.completed' && data?.metadata) {
      const meta = data.metadata;

      if (meta.type === 'blitz_call') {
        const userId = Number(meta.user_id);
        const startsAt = meta.starts_at;
        const notes = meta.notes || '';
        const durationMin = 30;
        const end = new Date(new Date(startsAt).getTime() + durationMin * 60 * 1000);

        await query(
          `INSERT INTO bookings (user_id, meeting_type_slug, starts_at, ends_at, notes, stripe_session_id, payment_status, amount_cents)
           VALUES ($1, 'blitz-call', $2, $3, $4, $5, 'paid', $6)`,
          [userId, startsAt, end.toISOString(), notes, data.id, BLITZ_PRICE_CENTS],
        );
        print('[stripe] blitz call booked and paid');
      }

      if (meta.type === 'merch_order') {
        await query(
          `UPDATE merch_orders SET payment_status = 'paid', stripe_session_id = $1
           WHERE email = $2 AND payment_status = 'pending'
           ORDER BY created_at DESC LIMIT 1`,
          [data.id, meta.email],
        );
        print('[stripe] merch order marked paid');
      }

      if (meta.type === 'hosting_subscription') {
        const userId = Number(meta.user_id);
        const subscriptionId = data.subscription;
        await query(
          `INSERT INTO hosting_subscriptions (user_id, stripe_subscription_id, tier, billing_cycle, status)
           VALUES ($1, $2, $3, $4, 'active')
           ON CONFLICT (stripe_subscription_id) DO UPDATE SET status = 'active', updated_at = now()`,
          [userId, subscriptionId, meta.tier, meta.cycle],
        );
        print('[stripe] hosting subscription activated');
      }
    }

    if (type === 'customer.subscription.deleted' && data?.id) {
      await query(
        `UPDATE hosting_subscriptions SET status = 'cancelled', updated_at = now()
         WHERE stripe_subscription_id = $1`,
        [data.id],
      );
      print('[stripe] subscription cancelled');
    }

    if (type === 'customer.subscription.updated' && data?.id) {
      await query(
        `UPDATE hosting_subscriptions SET status = $1, updated_at = now(),
         current_period_start = $2, current_period_end = $3
         WHERE stripe_subscription_id = $4`,
        [data.status, new Date(data.current_period_start * 1000), new Date(data.current_period_end * 1000), data.id],
      );
    }
  } catch (err) {
    console.error('stripe webhook handler:', err);
  }

  res.json({ received: true });
});

function print(msg) {
  console.log(msg);
}

export default router;
