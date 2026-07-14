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

export function stripeConfigured() {
  return !!process.env.STRIPE_SECRET_KEY;
}
