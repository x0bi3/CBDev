# CreativeBuilds Platform Spec (Dashboard + Headless API + Demo Tenant)

> **This is spec 2 of 3. Read `CREATIVEBUILDS_README.md` first for the full
> document set and read order. Marketing site lives in
> `creativebuilds-pro-spec.md`. Pricing tiers and feature matrix live in
> `creativebuilds-pricing-spec.md`.**

> **Cursor Agent: This spec depends on the marketing spec and pricing spec.
> Do not begin implementation until `/PLAN.md` is reviewed and approved.**

---

## 1. What This Is

The platform is the authenticated dashboard at `app.creativebuilds.dev` where
CreativeBuilds' paying clients (site owners like "Legacy Tables" or "Iggy's
Mocs") log in to manage the data that powers their own websites.

Client websites themselves live on their own custom domains and are hosted
separately (some are already deployed manually today). The platform is the
**headless data layer + management UI** behind those sites. Client sites
consume platform data via a public tenant-scoped API.

To prove the end-to-end loop works, this build must also ship a single
reference client site at `demo.creativebuilds.dev`.

---

## 2. Existing Infrastructure Reconciliation

CreativeBuilds already has a database and (likely) an auth system in place.
Cursor's `/PLAN.md` MUST include a first-phase infrastructure audit:

### Database audit

- Connect to the existing database in a read-only capacity during planning.
- Enumerate every table, column, index, constraint, and foreign key.
- Produce an ER diagram (mermaid is fine) in `/PLAN.md`.
- For each existing table, mark one of:
  - `KEEP` — usable as-is
  - `MODIFY` — usable but needs schema changes (document them)
  - `DEPRECATE` — replace with new table (document migration path)
  - `DROP` — dead weight, safe to remove
- Do NOT execute schema changes during planning. Propose migrations, wait for
  owner approval, then execute.
- Preserve all client data during any migration. Migrations must be reversible
  and tested against a snapshot before touching production.

### Auth audit

- Identify the auth mechanism currently in use.
- Assess it against this checklist and report gaps in `/PLAN.md`:
  - Passwords hashed with a modern algorithm (argon2id preferred, bcrypt cost 12+ acceptable)
  - HTTPS-only session cookies with `HttpOnly`, `Secure`, `SameSite=Lax`
  - CSRF protection on all state-changing routes
  - Rate limiting on login and password-reset endpoints
  - Password reset via time-limited signed tokens (not predictable ids)
  - Email verification on signup
  - Optional MFA support (TOTP at minimum)
  - Session invalidation on password change
  - Audit log for auth events (login, logout, password change, MFA change)
- If any check fails, propose the smallest safe upgrade path. Do not rip-and-replace
  a working auth system to install a fashionable one.

### API surface audit

- Document any existing API endpoints the current client sites consume.
- Categorize as `KEEP`, `VERSION`, `DEPRECATE` — same rubric as tables.
- The new headless API (Section 9) must be additive; do not break sites that
  are already live in production.

---

## 3. Multi-Tenancy Model

The platform is multi-tenant. Every piece of client data belongs to a `tenant`.

### Concepts

- **User** — a human with credentials.
- **Tenant** — a client business / site (e.g. Legacy Tables, Iggy's Mocs, Demo).
- **Membership** — join table linking users to tenants with a role.

### Roles per tenant

- `owner` — full access, billing, delete tenant
- `admin` — full access except billing and delete
- `editor` — content/inventory/orders/customers/blog/calendar CRUD
- `viewer` — read-only

A user may belong to multiple tenants (agencies, partners). The dashboard UI
must include a tenant switcher in the top nav for these users.

### Data isolation

- Every tenant-owned row must include `tenant_id` as a non-nullable foreign key.
- All queries in the application layer MUST filter by the current tenant.
- Enforce with a database-level row-level security policy where the DB supports
  it (Postgres RLS). Application-layer filtering is required regardless; RLS is
  a defense-in-depth backstop.
- API keys are tenant-scoped. A leaked key exposes exactly one tenant.

---

## 4. Dashboard Information Architecture

Base URL: `app.creativebuilds.dev`. All routes below assume authenticated
context with a selected tenant.

### 4.1 Top-level nav

- `Overview` — landing dashboard for the tenant
- `Inventory` — products / SKUs
- `Orders` — order history, invoices, metrics
- `Customers` — customer directory
- `Blog` — CMS
- `Calendar` — bookings and availability
- `Tickets` — tenant's own support tickets (from marketing spec §7.6)
- `Settings` — everything below
- Tenant switcher (top-right) if user has multi-tenant membership

Feature-gate the nav so disabled features (per pricing tier) are hidden or
show a `Upgrade to enable` state. See `creativebuilds-pricing-spec.md`.

### 4.2 Overview (`/overview`)

Landing view for the selected tenant. Includes:

- Site health card (last publish, live URL, uptime if we monitor it)
- Sales-this-month card (if orders enabled)
- Upcoming bookings card (if calendar enabled)
- Recent orders / recent bookings / recent tickets (three compact panels)
- Quick actions: Add product, Create blog post, Open tickets

---

## 5. Inventory Subsystem

Available on Tier 2 and Tier 3. Hidden with upgrade prompt on Tier 1.

### Data model per product

- `id`, `tenant_id`, `created_at`, `updated_at`, `deleted_at` (soft delete)
- `name`, `slug` (unique per tenant), `description` (rich text)
- `status` — `draft` / `active` / `archived`
- `sku` (optional but recommended), `barcode` (optional)
- `price` (cents, currency code)
- `compare_at_price` (optional, for "was/now" display) — client controls, no fake discounts enforced by us
- `cost` (optional, for internal margin tracking — never surfaced on client site)
- `tax_class` (default / reduced / zero / custom)
- `track_inventory` (bool) — if true, `stock_quantity` enforced
- `stock_quantity`, `low_stock_threshold`
- `allow_backorder` (bool)
- `weight_grams`, `length_mm`, `width_mm`, `height_mm` (for shipping)
- `requires_shipping` (bool)
- `is_digital` (bool)
- `download_url` (optional, for digital products, signed on delivery)
- `category_ids[]` (many-to-many with tenant-owned categories)
- `tag_ids[]` (many-to-many)
- `images[]` — ordered array of image records (see below)
- `variants[]` — optional (see below)
- `seo_title`, `seo_description`, `seo_slug_override`

### Product images

- Uploaded via presigned URLs to object storage (S3 or R2).
- Server processes to generate responsive derivatives (thumbnail, medium, full).
- Stored records: `id`, `product_id`, `sort_order`, `alt_text`, `url`, `derivatives{}`.
- Client sites receive the derivative set; they pick which size to render.

### Variants (optional per product)

- Product may have zero or more variants (size, color, material).
- Each variant has its own `sku`, `price`, `stock_quantity`, `image_id` (optional).
- Option axes are tenant-defined (e.g. "Size: S/M/L, Color: Red/Blue").

### Categories and tags

- Tenant-owned, tenant-scoped.
- Categories are hierarchical (parent_id nullable, self-referencing).
- Tags are flat.

### Dashboard UI

- **List view**: sortable, filterable table with inline status toggle, stock
  count, thumbnail. Bulk select for delete / archive / export.
- **Editor**: single-page form with sections: Basics, Media, Pricing,
  Inventory, Shipping, Variants, Categories/Tags, SEO. Autosave draft.
- **Import/Export**: CSV import with column mapping preview; CSV export
  of full catalog.

### Metrics

- Top sellers (units, revenue) — last 30 days, quarter, year.
- Low stock alerts.
- Products with no sales in 90 days.

---

## 6. Orders Subsystem

Available on Tier 2 and Tier 3.

### Data model per order

- `id`, `tenant_id`, `order_number` (per-tenant sequential), `created_at`
- `customer_id` (nullable if guest checkout)
- `email`, `phone`
- `status` — `pending` / `paid` / `fulfilled` / `refunded` / `cancelled`
- `payment_status` — `unpaid` / `authorized` / `paid` / `partially_refunded` / `refunded`
- `fulfillment_status` — `unfulfilled` / `partial` / `fulfilled`
- `line_items[]` — `product_id`, `variant_id`, `quantity`, `unit_price`, `subtotal`
- `subtotal`, `shipping_total`, `tax_total`, `discount_total`, `platform_fee`, `total`
- `currency`
- `shipping_address{}`, `billing_address{}`
- `shipping_method`, `tracking_number` (nullable)
- `stripe_payment_intent_id`, `stripe_charge_id`, `stripe_application_fee_id`
- `notes` (internal), `tags[]`

### Dashboard UI

- List view with status filters, date range, customer search.
- Detail view with line items, customer info, addresses, payment history,
  refund controls, tracking entry, internal notes.
- Actions: mark fulfilled, add tracking, refund (partial or full via Stripe
  Connect refund), resend confirmation email, cancel.

### Invoicing

- Every paid order auto-generates a PDF invoice.
- Manual invoice creation available for off-platform sales:
  - Choose customer or enter new one
  - Add line items (from inventory or free-form)
  - Set due date
  - Send via email with a hosted-invoice-page link (Stripe Invoicing under Connect)
- Invoice states: `draft` / `sent` / `viewed` / `paid` / `overdue` / `void`.

### Metrics

- Revenue (day/week/month/quarter/year) with sparkline.
- Average order value.
- Refund rate.
- Top products by revenue.
- Fulfillment SLA (avg hours from paid to fulfilled).

---

## 7. Customers Subsystem

Available on all tiers (a client always has an audience, even without inventory).

### Data model per customer

- `id`, `tenant_id`, `created_at`, `updated_at`
- `email` (unique per tenant), `phone`, `first_name`, `last_name`
- `addresses[]` (shipping, billing)
- `default_shipping_address_id`, `default_billing_address_id`
- `marketing_consent` (bool + timestamp)
- `notes` (internal), `tags[]`
- Derived (not stored, computed): `orders_count`, `lifetime_value`, `last_order_at`

### Dashboard UI

- Searchable directory with filters (has-orders, marketing-consent, tags).
- Detail view: profile, order history, invoice history, notes, tags,
  merge-duplicates action.
- CRUD: create, edit, soft-delete (with orders preserved).
- Bulk actions: tag, export CSV, email export (respects consent).

---

## 8. Blog Subsystem (Internal CMS)

Available on all tiers if the client enables it in Settings.

### Data model per post

- `id`, `tenant_id`, `created_at`, `updated_at`, `published_at` (nullable)
- `title`, `slug` (unique per tenant), `excerpt`
- `body` — structured rich text (see below)
- `cover_image_id`
- `status` — `draft` / `scheduled` / `published` / `archived`
- `scheduled_for` (nullable) — for scheduled publishing
- `author_id`, `author_display_name`
- `category_ids[]`, `tag_ids[]`
- `seo_title`, `seo_description`, `og_image_id`
- `reading_time_minutes` (computed)

### Rich text editor

- Block-based editor (Tiptap recommended for Next.js compatibility).
- Supported blocks: paragraph, heading (H2-H4), bulleted list, numbered list,
  quote, code (with language), image, embed (YouTube/Vimeo/generic oEmbed),
  divider, callout, table.
- Inline marks: bold, italic, underline, strikethrough, code, link.
- Store as structured JSON, not raw HTML. Serialize to HTML on API delivery.
- Image upload uses same pipeline as product images (§5).

### Publishing

- Save draft (autosave every 10s while editing).
- Preview (opens the post rendered as it will appear on the client site, using
  the tenant's site template via the headless API).
- Publish now.
- Schedule for future publish (background job flips status at the scheduled time).
- Unpublish (returns to draft, invalidates client-site cache).

### CMS categories/tags/authors

- Tenant-owned taxonomy just like inventory.
- Authors are Users with tenant membership; display name overridable per-post.

---

## 9. Calendar & Bookings Subsystem

Available on Tier 2 and Tier 3. Hidden with upgrade prompt on Tier 1.

### Concepts

- **Event type** — a bookable offering the tenant defines (e.g. "60-min
  Consultation", "Table Refinishing Estimate"). One tenant may have many.
- **Availability rule** — recurring blocks of time when the owner is bookable
  (e.g. Mon-Fri 9am-5pm America/Chicago), plus one-off blocks and blackouts.
- **Booking** — a specific reserved slot for a specific event type.

### Event type fields

- `id`, `tenant_id`, `name`, `slug` (unique per tenant)
- `description` (rich text)
- `duration_minutes`, `buffer_before_minutes`, `buffer_after_minutes`
- `location_type` — `in_person` / `phone` / `video_conf` / `custom`
- `location_details` (address, phone, meeting link generator, etc)
- `price` (cents, 0 for free bookings)
- `currency`
- `requires_payment` (bool) — if true, booking is only confirmed on payment
- `max_bookings_per_day` (nullable cap)
- `min_notice_hours` (how far in advance must be booked)
- `max_notice_days` (how far ahead can be booked)
- `active` (bool)
- `custom_questions[]` — free-form questions asked at booking time
- `cancellation_policy` (text)

### Free vs paid bookings

- If `requires_payment = false`: booking confirmed immediately on submit,
  confirmation email sent, calendar invite generated.
- If `requires_payment = true`: booking held for 15 minutes as `pending_payment`,
  Stripe Checkout session opens, on payment success booking is confirmed and
  platform fee is applied (same fee tier as inventory orders). On payment
  timeout or failure, the slot is released.

### Availability rules

- Weekly recurring pattern per weekday with multiple time ranges per day.
- Timezone stored per tenant; UI shows both tenant TZ and viewer TZ.
- One-off overrides (extra availability or blackouts) with date ranges.
- Holidays: tenant-selectable regional holiday calendar to auto-block.

### External calendar integration

- OAuth connection to Google Calendar and Microsoft 365 (Outlook).
- Two-way sync: platform bookings appear on external calendar; external
  events block platform availability.
- iCal (`.ics`) subscription URL for read-only calendars.
- Handle sync failures gracefully with retry + owner notification.

### Booker-facing widget

- Not part of the dashboard UI directly, but served via the headless API so
  client sites can embed it.
- Standalone hosted booking page at `book.creativebuilds.dev/[tenant-slug]/[event-slug]`
  as a fallback for tenants without an embed.

### Dashboard UI

- Week / month calendar view of all bookings with color-coding per event type.
- Booking detail: attendee info, custom question answers, payment status,
  reschedule / cancel actions.
- Event type CRUD in a list view.
- Availability editor with visual weekly grid.

---

## 10. Tickets (Client-side view of the ticket system)

Tenants see their own tickets here. Fields, categories, and lifecycle are
defined in the marketing spec §7.6.

### Dashboard UI

- List with filters by status, category, priority.
- Detail thread view (client comments + developer replies + status changes).
- Reply / add attachment / close ticket actions.
- Tier-cap indicator: "You have used 3 of 5 tickets this period."
- Upgrade CTA when approaching or hitting cap.

---

## 11. Settings

Organized into tabs.

### 11.1 Profile

- User's own profile: display name, email, avatar, timezone, notification
  preferences.
- Change password (requires current password + new password).
- MFA setup (TOTP), if not already covered by existing auth.
- Active sessions list with revoke.

### 11.2 Tenant / Site

- Business name, business email, business phone, business address.
- Public contact fields shown on the client site (Contact / About).
- Logo upload.
- Brand color primary / secondary (surfaced to client-site template).
- Timezone, currency, default tax settings.
- Public site URL (custom domain the tenant owns).
- API key management: generate, rotate, revoke (see §12).

### 11.3 Team

- Members list with role.
- Invite by email (invite pending until accepted).
- Change role, remove member.
- Owner transfer flow (double-confirm).

### 11.4 Billing

- Current plan (Tier 1 / 2 / 3) with feature summary.
- Change plan (opens tier comparison, warns about feature loss on downgrade).
- Payment method (Stripe Customer Portal embed / redirect).
- Invoice history for platform subscription.
- Cancellation flow with retention step (show what they lose).
- Note: This section manages what the TENANT pays ME. Platform fee configuration
  is separate and applies to what tenant customers pay THEM (§13).

### 11.5 Payments (Stripe Connect onboarding)

- Only relevant if inventory or paid bookings are enabled.
- Stripe Connect onboarding button (Standard or Express — see pricing spec).
- Connection status indicator (Not connected / Onboarding incomplete / Active / Restricted).
- Payout schedule, bank account (managed inside Stripe Express dashboard link).
- Test mode toggle for pre-launch.

### 11.6 Feature toggles

- Enable Blog on client site (on/off).
- Enable Calendar on client site (on/off, gated by tier).
- Enable Inventory on client site (on/off, gated by tier).
- Enable Email Popup Capture on client site (on/off).
  - If on: configure trigger (time delay, scroll depth, exit intent),
    heading, body, CTA text, incentive text.
- Enable Shipping calculator on client site (on/off, requires shipping
  rates configured).
- Contact/About content that reflects on the client site (rich text
  fields consumed by the client site template).

### 11.7 Shipping

- Shipping zones (country / region groups).
- Per-zone rates (flat, weight-based, price-based, or per-item).
- Free-shipping threshold (optional).
- Handling fee (optional).
- Delivery time estimates per zone.

### 11.8 Notifications

- Which events email whom.
- Optional SMS on Tier 3.
- Webhooks: outbound webhook URLs for developers/integrations.

### 11.9 Danger Zone

- Export all data (JSON + media archive).
- Transfer ownership.
- Delete tenant (double confirm, 30-day grace with restoration option).

---

## 12. Headless API (for client sites to consume)

This is the API that live client sites (Legacy Tables, Iggy's Mocs, the demo
tenant, and future clients) will consume.

### Design principles

- REST-first with predictable resource URLs. Consider GraphQL only if `/PLAN.md`
  makes a strong case for it.
- Every request scoped by tenant via API key in header (`X-CB-Api-Key`) OR
  tenant slug in path for public endpoints.
- Read endpoints are public and cacheable at the edge.
- Write endpoints require authenticated API key with write scope.
- Version the API from day one: `/v1/...`.
- Rate limited per tenant and per key.
- CORS configured per tenant (whitelist tenant's site origin).

### Public read endpoints (examples)

- `GET /v1/{tenant}/products` — paginated list, filterable by category/tag/status
- `GET /v1/{tenant}/products/{slug}` — single product with variants + images
- `GET /v1/{tenant}/categories` — category tree
- `GET /v1/{tenant}/blog/posts` — paginated list, published only
- `GET /v1/{tenant}/blog/posts/{slug}` — single post (structured content)
- `GET /v1/{tenant}/calendar/event-types` — active event types
- `GET /v1/{tenant}/calendar/availability?event_type={slug}&from=&to=` — slots

### Write endpoints (examples)

- `POST /v1/{tenant}/checkout/sessions` — create Stripe Checkout for cart
- `POST /v1/{tenant}/bookings` — create pending booking, returns payment URL if needed
- `POST /v1/{tenant}/newsletter/subscribe` — email capture
- `POST /v1/{tenant}/contact` — contact form submission

### SDK

- Publish a small typed JavaScript client (`@creativebuilds/client`) that wraps
  the API. First consumer is the demo tenant site.
- Cursor should propose whether to ship this in v1 or defer.

### Cache / invalidation

- Public endpoints cached at CDN with tenant + resource as cache key.
- Mutations from the dashboard emit invalidation for affected keys.
- Client sites can also subscribe to a webhook for real-time invalidation.

---

## 13. Stripe Connect Integration

The platform-fee model (1% / 3% depending on tier) requires Stripe Connect.

### Account model

- CreativeBuilds is the Stripe Connect **platform account**.
- Each tenant with inventory or paid bookings is a **connected account**.
- Preferred connection type: **Standard** (tenant owns the Stripe account and
  the customer-support relationship, simplest onboarding for the tenant).
  `/PLAN.md` may argue for Express if a simpler onboarding UX is more important.

### Onboarding flow

- Tenant clicks "Set up payments" in Settings > Payments.
- Redirected to Stripe onboarding, returned to a callback route.
- Platform stores the connected account ID against the tenant.
- Onboarding status polled until `charges_enabled` and `payouts_enabled` are true.
- Blocked features (checkout, paid bookings) unlock automatically once ready.

### Payment flow

- Customer pays on client site via Checkout session.
- Charge is created on the connected account with an `application_fee_amount`
  equal to (subtotal * tier_platform_fee_percentage).
- Stripe automatically transfers the platform fee to the CreativeBuilds account
  and the remainder settles into the connected tenant account.
- Webhook (`payment_intent.succeeded`) triggers order creation, invoice
  generation, and confirmation emails.

### Refunds

- Initiated from the dashboard order detail.
- Application fee is refunded proportionally by default (configurable per refund).

### Platform subscription billing (separate concern)

- Tenants also pay the CreativeBuilds subscription (Tier 1/2/3 monthly or yearly).
- This uses standard Stripe Subscriptions on the platform account, NOT Connect.
- Use Stripe Customer Portal for self-service management.

---

## 14. Feature Gating

Feature availability by tier is defined in `creativebuilds-pricing-spec.md`.
Implementation requirements:

- Central `feature-gates` module. Never scatter tier checks across the codebase.
- Every gated feature checks against the tenant's current tier.
- UI hides or shows upgrade-CTA state for disabled features (never renders a
  broken control).
- API rejects requests to gated endpoints with `403 Feature Not Available` +
  tier-upgrade message.
- Ticket cap enforcement uses a rolling billing-period counter.
- Downgrade behavior: existing data is preserved but hidden. Re-enabling on
  upgrade brings it back.

---

## 15. Demo Tenant Requirement

Cursor MUST ship a working end-to-end demo:

### Setup

- Tenant slug: `demo`
- Client site at: `demo.creativebuilds.dev` (also multi-tenant-hosted by us
  since we own the domain — treated as any other client site consumer of the API).
- Seeded with: 6 sample products across 2 categories, 3 blog posts, 2 event
  types (one free, one paid), 2 sample customers, 1 sample order.
- Seeded user account:
  - Email or username: `Demo`
  - Password: `password`
  - Role: `owner` of the `demo` tenant
- Tier assigned: **Tier 3** (so all features are visible).
- Stripe Connect: connected to a test-mode account with the platform's test keys.

### Acceptance test (must be automated in Playwright)

The following flow must pass end-to-end:

1. Visit `www.creativebuilds.dev`, click Log In, sign in as `Demo` / `password`.
2. Land in dashboard, tenant `demo` selected.
3. Navigate to Inventory, click Add Product.
4. Fill: name "Test Widget", price $19.99, stock 5, upload one image, publish.
5. In a new browser tab, visit `demo.creativebuilds.dev`.
6. The product page or catalog must display "Test Widget" within 30 seconds of
   publishing (cache invalidation window).
7. Add product to cart, proceed through Stripe test-mode checkout with card
   `4242 4242 4242 4242`.
8. Return to dashboard Orders, verify the order appears with `paid` status
   and correct application fee (Tier 3 = 1%).

The Playwright test is a shipping artifact. It runs in CI and blocks releases
if it fails.

### Demo site template

- The demo site is a reference implementation of a client site.
- Uses the headless API, embeds the booking widget, displays inventory and
  blog.
- Doubles as a template Cursor can offer to future manually-onboarded clients.
- Design should reflect a plausible small-business look, NOT the dark-technical
  aesthetic of the CreativeBuilds marketing site.

---

## 16. Cross-Cutting Concerns

- **Observability**: structured logs, error tracking (Sentry), request tracing.
- **Backups**: nightly DB snapshots retained 30 days, monthly retained 12 months.
- **Rate limiting**: per-user, per-tenant, per-API-key.
- **Audit log**: every write to tenant data records who/what/when.
- **Time zones**: store UTC, present in tenant timezone by default, always
  display timezone abbreviation next to times.
- **Currency**: store integer minor units + ISO currency code, format on display.
- **File storage**: single object-storage provider, per-tenant prefix,
  signed URLs for private assets.
- **Localization**: not in v1 scope but do not hardcode English strings in
  ways that block future i18n.
- **Testing**: unit tests for domain logic, integration tests for API
  endpoints, Playwright E2E for critical flows (auth, checkout, booking,
  demo acceptance test).

---

## 17. Out of Scope for v1

- Mobile native apps for the dashboard (responsive web only).
- White-label reselling.
- Multi-currency per tenant (single currency per tenant is v1).
- Multi-language client sites.
- Live chat between tenant and their customers.
- Loyalty programs / gift cards / subscriptions on client sites.
- Full accounting integration (QuickBooks / Xero) — provide CSV export instead.
- AI-generated blog content or product descriptions.
- The migration of existing manually-hosted client sites (legacytables.us,
  etc) onto the new API — that's a separate rollout project. Design the API
  and prove it with the demo tenant first.

---

_End of platform spec. Continue to `creativebuilds-pricing-spec.md`._
