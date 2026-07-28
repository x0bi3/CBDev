import Stripe from 'stripe';
import { query } from '../db.js';

let _stripe = null;

export function getStripe() {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(key, { apiVersion: '2025-05-28.basil' });
  }
  return _stripe;
}

export async function getOrCreateCustomer(userId, email, name) {
  const { rows } = await query(
    'SELECT stripe_customer_id FROM stripe_customers WHERE user_id = $1',
    [userId],
  );
  if (rows[0]) return rows[0].stripe_customer_id;

  const stripe = getStripe();
  const customer = await stripe.customers.create({ email, name });

  await query(
    `INSERT INTO stripe_customers (user_id, stripe_customer_id) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET stripe_customer_id = $2`,
    [userId, customer.id],
  );
  return customer.id;
}

export const HOSTING_PRICES = {
  starter:   { monthly: 999,   yearly: 9999 },
  studio:    { monthly: 1999,  yearly: 19999 },
  signature: { monthly: 4999,  yearly: 49999 },
};

export const BLITZ_PRICE_CENTS = 2000;

/** Early Bird: 50% build (quote-side) + 25% off first yearly hosting invoice (Stripe). Cap: first 5. */
export const EARLYBIRD_CODE = 'EARLYBIRD';
export const EARLYBIRD_PIPELINE_CAP = 5;

export function stripeConfigured() {
  return !!process.env.STRIPE_SECRET_KEY;
}

/**
 * Resolve a customer-facing promo code to a Stripe Promotion Code id for Checkout discounts.
 * EARLYBIRD only applies to yearly hosting.
 */
export async function resolveHostingPromotionCode(code, cycle) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return null;

  if (normalized === EARLYBIRD_CODE && cycle !== 'yearly') {
    const err = new Error('EARLYBIRD applies to yearly hosting only (3 months free on the yearly plan).');
    err.status = 400;
    throw err;
  }

  const stripe = getStripe();
  const listed = await stripe.promotionCodes.list({ code: normalized, active: true, limit: 1 });
  const promo = listed.data[0];
  if (!promo) {
    const err = new Error('Invalid or inactive promo code.');
    err.status = 400;
    throw err;
  }
  if (promo.max_redemptions != null && promo.times_redeemed >= promo.max_redemptions) {
    const err = new Error('Early Bird is full (first 5 clients).');
    err.status = 400;
    throw err;
  }
  return { id: promo.id, code: promo.code };
}

/** Count sent/paid EARLYBIRD quotes toward the pipeline cap. */
export async function countEarlyBirdQuotes() {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n FROM quotes
     WHERE UPPER(promo_code) = $1 AND status IN ('sent', 'paid')`,
    [EARLYBIRD_CODE],
  );
  return rows[0]?.n || 0;
}

export async function assertEarlyBirdQuoteSlot() {
  const n = await countEarlyBirdQuotes();
  if (n >= EARLYBIRD_PIPELINE_CAP) {
    const err = new Error('Early Bird is full (first 5 clients through the pipeline).');
    err.status = 400;
    throw err;
  }
  return EARLYBIRD_PIPELINE_CAP - n;
}
