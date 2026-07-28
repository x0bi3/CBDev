import { Router } from 'express';
import crypto from 'node:crypto';
import { query } from '../db.js';
import { requireAuth, hashPassword, normalizeUsername } from '../auth.js';
import { getStripe, getOrCreateCustomer, HOSTING_PRICES, BLITZ_PRICE_CENTS, stripeConfigured, resolveHostingPromotionCode } from '../lib/stripe.js';
import { sendQuotePaidWelcome, notifyQuotePaid, quotePublicBase } from '../lib/email.js';
import { URLS } from '../lib/urls.js';
import { provisionPlatformTenant } from '../lib/platformTenant.js';

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
    const { rows: userRows } = await query('SELECT email, name FROM users WHERE id = $1', [req.userId]);
    const user = userRows[0];
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const startsAt = String(req.body.startsAt || '').trim();
    const notes = req.body.notes ? String(req.body.notes).trim() : '';

    if (!startsAt) { res.status(400).json({ error: 'Start time required' }); return; }

    const customerId = await getOrCreateCustomer(req.userId, user.email, user.name);

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

/** Public marketing checkout (no studio auth) — used by test/www hosting pages. */
router.post('/checkout/marketing-hosting', async (req, res) => {
  try {
    if (!stripeConfigured()) {
      res.status(503).json({ error: 'Stripe not configured' });
      return;
    }
    const stripe = getStripe();
    const tier = String(req.body.tier || '').trim().toLowerCase();
    const cycle = String(req.body.cycle || 'monthly').trim();
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!HOSTING_PRICES[tier]) {
      res.status(400).json({ error: 'Invalid tier' });
      return;
    }
    if (cycle !== 'monthly' && cycle !== 'yearly') {
      res.status(400).json({ error: 'Invalid cycle' });
      return;
    }
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Valid email required' });
      return;
    }

    const priceAmount = cycle === 'yearly' ? HOSTING_PRICES[tier].yearly : HOSTING_PRICES[tier].monthly;
    const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
    const successBase =
      process.env.MARKETING_CHECKOUT_SUCCESS_URL ||
      process.env.WWW_URL ||
      'https://test.creativebuilds.dev';

    const rawPromo = req.body.promotion_code || req.body.promo_code || '';
    let discounts;
    let promoMeta = {};
    if (rawPromo) {
      const promo = await resolveHostingPromotionCode(rawPromo, cycle);
      if (promo) {
        discounts = [{ promotion_code: promo.id }];
        promoMeta = { promo_code: promo.code };
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer_email: email,
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
      ...(discounts ? { discounts } : {}),
      metadata: { type: 'marketing_hosting_subscription', tier, cycle, email, ...promoMeta },
      success_url: `${successBase}/hosting?session_id={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url: `${successBase}/hosting?status=cancelled`,
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('stripe marketing hosting checkout:', err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Checkout failed' });
  }
});

/** Public quote deposit checkout (no auth) — client pays 25% from the /quote page. */
router.post('/checkout/quote', async (req, res) => {
  try {
    if (!stripeConfigured()) {
      res.status(503).json({ error: 'Stripe not configured' });
      return;
    }
    const stripe = getStripe();
    const publicId = String(req.body.public_id || req.body.id || '').trim();
    if (!publicId) { res.status(400).json({ error: 'Quote id required' }); return; }

    const { rows } = await query(
      `SELECT public_id, client_name, client_email, category, deposit_cents, total_cents, status, promo_code
       FROM quotes WHERE public_id = $1`,
      [publicId],
    );
    const quote = rows[0];
    if (!quote || quote.status === 'draft') { res.status(404).json({ error: 'Quote not found' }); return; }
    if (quote.status === 'paid') { res.status(409).json({ error: 'Deposit already paid' }); return; }
    if (!quote.deposit_cents || quote.deposit_cents < 50) { res.status(400).json({ error: 'Invalid deposit amount' }); return; }

    const successBase = quotePublicBase().replace(/\/$/, '');
    const session = await stripe.checkout.sessions.create({
      customer_email: quote.client_email,
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `CreativeBuilds deposit — ${quote.category || 'Project'} (${quote.public_id})`,
            description: 'Non-final deposit to reserve your build slot. Refundable within 48 hours.',
          },
          unit_amount: quote.deposit_cents,
        },
        quantity: 1,
      }],
      metadata: {
        type: 'quote',
        public_id: quote.public_id,
        email: quote.client_email,
        ...(quote.promo_code ? { promo_code: String(quote.promo_code).toUpperCase() } : {}),
      },
      success_url: `${successBase}/quote?id=${encodeURIComponent(quote.public_id)}&status=success`,
      cancel_url: `${successBase}/quote?id=${encodeURIComponent(quote.public_id)}&status=cancelled`,
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('stripe quote checkout:', err);
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

    const { rows: userRows } = await query('SELECT email, name FROM users WHERE id = $1', [req.userId]);
    const user = userRows[0];
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const customerId = await getOrCreateCustomer(req.userId, user.email, user.name);
    const priceAmount = cycle === 'yearly' ? HOSTING_PRICES[tier].yearly : HOSTING_PRICES[tier].monthly;
    const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

    const rawPromo = req.body.promotion_code || req.body.promo_code || '';
    let discounts;
    let promoMeta = {};
    if (rawPromo) {
      const promo = await resolveHostingPromotionCode(rawPromo, cycle);
      if (promo) {
        discounts = [{ promotion_code: promo.id }];
        promoMeta = { promo_code: promo.code };
      }
    }

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
      ...(discounts ? { discounts } : {}),
      metadata: { type: 'hosting_subscription', user_id: String(req.userId), tier, cycle, ...promoMeta },
      success_url: `${baseUrl()}/settings?session_id={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url: `${baseUrl()}/settings?status=cancelled`,
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('stripe hosting checkout:', err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Checkout failed' });
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

      if (meta.type === 'hosting_subscription' || meta.type === 'marketing_hosting_subscription') {
        const userId = meta.user_id ? Number(meta.user_id) : null;
        const subscriptionId = data.subscription;
        const email = meta.email || data.customer_details?.email || data.customer_email;
        let uid = userId;
        if (!uid && email) {
          const { rows: u } = await query('SELECT id FROM users WHERE email = $1', [String(email).toLowerCase()]);
          uid = u[0]?.id || null;
        }
        if (uid && subscriptionId) {
          await query(
            `INSERT INTO hosting_subscriptions (user_id, stripe_subscription_id, tier, billing_cycle, status)
             VALUES ($1, $2, $3, $4, 'active')
             ON CONFLICT (stripe_subscription_id) DO UPDATE SET status = 'active', updated_at = now()`,
            [uid, subscriptionId, meta.tier, meta.cycle],
          );
          print('[stripe] hosting subscription activated', meta.type);
        } else {
          console.error('hosting webhook: missing user or subscription', meta);
        }
      }

      if (meta.type === 'quote' && meta.public_id) {
        await onQuotePaid(meta.public_id, data.id);
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

/** Marks a quote paid, kickstarts the CBDev account, and emails onboarding. Idempotent. */
export async function onQuotePaid(publicId, sessionId) {
  const { rows } = await query('SELECT * FROM quotes WHERE public_id = $1', [publicId]);
  const quote = rows[0];
  if (!quote) { console.error('quote paid webhook: unknown quote', publicId); return; }
  if (quote.status === 'paid') { print('[stripe] quote already paid, skipping'); return; }

  await query(
    `UPDATE quotes SET status = 'paid', paid_at = now(), stripe_session_id = $1, updated_at = now()
     WHERE id = $2`,
    [sessionId, quote.id],
  );

  const email = String(quote.client_email || '').trim().toLowerCase();
  if (!email) { print('[stripe] quote paid but no client email'); return; }

  // Upsert the account (kickstarts onboarding).
  let user;
  const { rows: existing } = await query('SELECT id, email, name FROM users WHERE email = $1', [email]);
  if (existing[0]) {
    user = existing[0];
  } else {
    let username = normalizeUsername(email.split('@')[0]) || `client${Date.now().toString(36)}`;
    const { rows: taken } = await query('SELECT 1 FROM users WHERE LOWER(username) = $1', [username]);
    if (taken[0]) username = `${username.slice(0, 24)}${Math.random().toString(36).slice(2, 6)}`;
    const placeholder = await hashPassword(crypto.randomBytes(24).toString('hex'));
    const name = quote.client_name || email.split('@')[0];
    const { rows: created } = await query(
      `INSERT INTO users (email, username, name, password_hash, role)
       VALUES ($1, $2, $3, $4, 'user') RETURNING id, email, name`,
      [email, username, name, placeholder],
    );
    user = created[0];
    print('[stripe] created CBDev account from paid quote');
  }

  // Set-password / magic link (reuses password_resets, 24h).
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt],
  );
  const setPasswordUrl = `${(URLS.app || 'https://app.creativebuilds.dev').replace(/\/$/, '')}/onboarding?token=${rawToken}`;

  const businessName = quote.client_name || quote.project_name || 'Client Site';
  const slug = (quote.project_slug || businessName).toString();
  try {
    await provisionPlatformTenant({
      businessName,
      slug,
      tier: quote.tier || 'studio',
      userId: user.id,
      contactEmail: email,
    });
  } catch (err) {
    console.error('platform tenant provision:', err);
  }

  try {
    await sendQuotePaidWelcome(user, quote, setPasswordUrl);
    await notifyQuotePaid(quote);
  } catch (err) {
    console.error('quote paid emails:', err);
  }
  print('[stripe] quote deposit paid, onboarding started');
}

function print(msg) {
  console.log(msg);
}

/** Customer Portal for Path 1 — tenant manages CB hosting subscription */
router.post('/billing-portal', requireAuth, async (req, res) => {
  try {
    if (!stripeConfigured()) {
      res.status(503).json({ error: 'Stripe not configured' });
      return;
    }
    const stripe = getStripe();
    const { rows } = await query(
      'SELECT email, name FROM users WHERE id = $1',
      [req.userId],
    );
    const user = rows[0];
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const customerId = await getOrCreateCustomer(req.userId, user.email, user.name);
    const returnUrl = `${(URLS.app || 'https://app.creativebuilds.dev').replace(/\/$/, '')}/settings`;
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('stripe billing portal:', err);
    res.status(500).json({ error: err.message || 'Portal unavailable' });
  }
});

export default router;
