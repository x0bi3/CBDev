# CreativeBuilds Pricing & Tier Feature Matrix

> **This is spec 3 of 3. Read `CREATIVEBUILDS_README.md` first for the full
> document set and read order. Marketing site lives in
> `creativebuilds-pro-spec.md`. Platform / dashboard lives in
> `creativebuilds-platform-spec.md`.**

> **Cursor Agent: This document is the single source of truth for pricing
> tiers, feature availability, and Stripe product mapping. If any other spec
> disagrees with this file, THIS file wins. Implement tier logic against a
> single `TIERS` config module derived from this matrix; do not scatter tier
> checks around the codebase.**

---

## 1. Service Categories

The `/pricing` page (marketing spec §7.5) offers a segmented selector for
these service categories:

| Category                       | v1 status       |
| ------------------------------ | --------------- |
| Website                        | Live (this doc) |
| Custom Software                | Placeholder     |
| Mobile App                     | Placeholder     |
| Integrations & Automation      | Placeholder     |
| Consulting / Fractional CTO    | Placeholder     |

Placeholder categories render a "Get in touch for pricing" card with a CTA to
`/inquiry?category=<slug>`. Do not invent numbers.

---

## 2. Website Tiers

### Tier 1 — Starter

- **Monthly**: $9.99 / month
- **Yearly**: $99.99 / year (equivalent to $8.33 / month, ~17% off)
- **Tagline**: "A polished landing page, live on the web."
- **Who it's for**: Solo operators and small local businesses who need a
  presence, not a store.

**Included:**

- Static hosted site / landing page
- Up to 5 sections (About, Location, Contact, etc.)
- 5 ticket requests per billing period
- Blog (optional toggle)
- Custom domain support
- SSL certificate
- Standard email support (response within 3 business days)

**NOT included:**

- Inventory / product catalog
- Booking / calendar
- Paid bookings
- Stripe Connect payments
- Priority support channels

**Platform fee on customer transactions**: N/A (no transactions on this tier)

---

### Tier 2 — Studio

- **Monthly**: $19.99 / month
- **Yearly**: $199.99 / year (equivalent to $16.67 / month, ~17% off)
- **Tagline**: "A working business site with commerce and bookings."
- **Who it's for**: Established small businesses selling products, taking
  bookings, or both.
- **Recommended tier** — apply subtle "recommended" visual treatment on the
  pricing page.

**Included (everything in Tier 1, plus):**

- Full website architecture (unlimited sections)
- 25 ticket requests per billing period
- Inventory management (unlimited products)
- Booking / calendar (unlimited event types)
- Paid bookings via Stripe Connect
- Email popup capture
- Shipping calculator
- Custom brand color configuration
- Priority email support (response within 1 business day)
- Priority phone support (business hours)

**Platform fee on customer transactions**: **3%** of subtotal, applied via
Stripe Connect `application_fee_amount`. Applies to product sales and paid
bookings. Does not apply to shipping or tax.

---

### Tier 3 — Signature

- **Monthly**: $49.99 / month
- **Yearly**: $499.99 / year (equivalent to $41.67 / month, ~17% off)
- **Tagline**: "Maximum creative potential, minimum platform fee."
- **Who it's for**: Growing businesses where the reduced platform fee pays for
  the tier upgrade many times over.

**Included (everything in Tier 2, plus):**

- No ticket request cap (fair-use policy applies)
- Early access to new platform features
- Priority SMS support in addition to email and phone
- Multiple team members with role-based access
- Custom webhooks for outbound integrations
- Dedicated onboarding call

**Platform fee on customer transactions**: **1%** of subtotal.

---

## 3. Feature Matrix (canonical)

Cursor: derive the `TIERS` config module directly from this table. Every gate
in code MUST resolve back to a row here.

| Feature Key                    | Tier 1 | Tier 2 | Tier 3 |
| ------------------------------ | :----: | :----: | :----: |
| `hosting.custom_domain`        |   Y    |   Y    |   Y    |
| `hosting.ssl`                  |   Y    |   Y    |   Y    |
| `site.sections_max`            |   5    |   inf  |   inf  |
| `blog.enabled_toggle`          |   Y    |   Y    |   Y    |
| `inventory.enabled`            |   N    |   Y    |   Y    |
| `inventory.products_max`       |   0    |   inf  |   inf  |
| `orders.enabled`               |   N    |   Y    |   Y    |
| `calendar.enabled`             |   N    |   Y    |   Y    |
| `calendar.paid_bookings`       |   N    |   Y    |   Y    |
| `calendar.external_sync`       |   N    |   Y    |   Y    |
| `email_popup.enabled`          |   N    |   Y    |   Y    |
| `shipping.calculator`          |   N    |   Y    |   Y    |
| `brand.custom_colors`          |   N    |   Y    |   Y    |
| `team.members_max`             |   1    |   3    |   inf  |
| `webhooks.outbound`            |   N    |   N    |   Y    |
| `tickets.per_period_max`       |   5    |   25   |   inf  |
| `support.email`                | Std    | Prio   | Prio   |
| `support.phone`                |   N    |   Y    |   Y    |
| `support.sms`                  |   N    |   N    |   Y    |
| `early_access`                 |   N    |   N    |   Y    |
| `onboarding_call`              |   N    |   N    |   Y    |
| `platform_fee_percent`         |  N/A   |  3.0   |  1.0   |

Legend: Y = enabled, N = disabled, inf = unlimited, N/A = not applicable,
numeric = quota, Std/Prio = service level.

---

## 4. Billing Periods

- Monthly and yearly, priced as above.
- Yearly is billed upfront, non-refundable after 14 days, prorated on upgrade.
- No hidden setup fees.
- Free trial: **14 days** on Tier 2 for new accounts (Cursor: confirm this
  policy in `/PLAN.md` before implementing — it can be turned off).

---

## 5. Plan Change Behavior

### Upgrade (Tier 1 → 2, Tier 2 → 3, or Tier 1 → 3)

- Prorated charge for the remainder of the current period.
- New features unlocked immediately.
- No data migration needed — data was always there, gates just open.

### Downgrade (Tier 3 → 2, Tier 2 → 1, or Tier 3 → 1)

- Takes effect at the end of the current billing period (no refund of unused
  portion).
- Warn the user before confirming, listing every feature they will lose and
  every dataset that will become hidden:
  - Downgrading from a tier with inventory disabled: existing products remain
    stored and become invisible to the client site until re-upgraded.
  - Downgrading past calendar: existing bookings honored to completion,
    future booking capability disabled.
  - Ticket cap enforcement resets against new tier on next billing period.
- Team members exceeding the new tier's cap: keep existing memberships active
  but block new invites until under the cap OR the user removes members.
- Data is NEVER deleted on downgrade.

### Cancellation

- Takes effect at end of current billing period.
- 30-day grace with restore option.
- After grace: data export offered by email, then hard delete after 30 more days.

---

## 6. Stripe Product Mapping

Cursor: create these Stripe products and prices during environment setup.
Store product IDs in env vars, not hardcoded.

| Stripe Product     | Prices                                | Purpose                       |
| ------------------ | ------------------------------------- | ----------------------------- |
| `cb_tier_starter`  | `$9.99/mo`, `$99.99/yr`               | Tier 1 subscription           |
| `cb_tier_studio`   | `$19.99/mo`, `$199.99/yr`             | Tier 2 subscription           |
| `cb_tier_signature`| `$49.99/mo`, `$499.99/yr`             | Tier 3 subscription           |

Platform fee is NOT a Stripe product — it's applied per-transaction via
`application_fee_amount` on Connect charges.

Env vars required:

```
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CONNECT_CLIENT_ID=
STRIPE_PRICE_TIER1_MONTHLY=
STRIPE_PRICE_TIER1_YEARLY=
STRIPE_PRICE_TIER2_MONTHLY=
STRIPE_PRICE_TIER2_YEARLY=
STRIPE_PRICE_TIER3_MONTHLY=
STRIPE_PRICE_TIER3_YEARLY=
```

Never commit secrets. Provide a `.env.example` with these keys blank.

---

## 7. Copy and Presentation Rules

- Always show prices as `$9.99` (dollar sign, two decimals) — never `9.99 USD`
  in customer-facing surfaces.
- Yearly savings shown as "Save ~17%" or "$X off" — do the math, don't lie.
- Platform fee shown as its own line item on the pricing card AND explained
  in a tooltip: "3% is deducted from each customer transaction on your site
  and paid to CreativeBuilds. Stripe processing fees are separate."
- Never use dark patterns:
  - No "was $X now $Y" fake anchoring on tier prices
  - No "only X spots left" fake scarcity
  - No hidden auto-renewal (must be explicit)
- Currency: USD only in v1. Multi-currency is out of scope.

---

## 8. Enforcement Contract

Every place in the codebase that gates behavior on tier MUST:

1. Import from the central `feature-gates` module.
2. Reference a `Feature Key` from the matrix above by string constant.
3. On denied access, return a structured error with:
   - `code`: `FEATURE_NOT_AVAILABLE`
   - `feature`: the key name
   - `current_tier`: the tenant's tier
   - `required_tier`: minimum tier required
   - `upgrade_url`: link to `/settings/billing`
4. The UI translates this into the standard upgrade-CTA component.

Cursor must include a test that:

- Iterates every `Feature Key` in the matrix
- Verifies each tier's behavior matches the table
- Fails if a new feature is added to code without a matrix entry

---

_End of pricing spec._
