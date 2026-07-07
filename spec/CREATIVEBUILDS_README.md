# CreativeBuilds Build Spec — Index

> **Cursor Agent: Start here. This document tells you what to read, in what
> order, and what to produce. Do not begin implementation code until your
> `/PLAN.md` deliverable has been reviewed and approved by the owner.**

---

## The Project in One Paragraph

Build the new professional face of CreativeBuilds at `www.creativebuilds.dev`
— a dark-technical marketing site pitching an independent senior developer's
consulting business — plus the authenticated multi-tenant SaaS platform at
`app.creativebuilds.dev` that CreativeBuilds' paying clients use to manage
their own websites (inventory, orders, blog, calendar, customers, settings,
Stripe Connect payments, support tickets). Prove the end-to-end loop with a
working demo tenant at `demo.creativebuilds.dev` using credentials
`Demo` / `password`.

---

## Read Order

Read all four specs in this order before writing anything:

1. **`creativebuilds-tooling-spec.md`** — milestone M0. Local environment
   bootstrap, MCP configuration, Postgres migration (SSH-to-Pi → official
   Postgres MCP), GitHub repo creation for `pro_cbdev`, Blender install &
   integration modes. Cursor executes system checks HERE FIRST and produces
   a `BOOTSTRAP_REPORT.md` before touching anything else.
2. **`creativebuilds-pro-spec.md`** — the public marketing site, navigation,
   inquiry flow, interactive pricing page.
3. **`creativebuilds-platform-spec.md`** — the authenticated dashboard,
   multi-tenancy model, all subsystems (inventory, orders, customers, blog,
   calendar, tickets, settings), headless API, Stripe Connect, and the demo
   tenant acceptance test.
4. **`creativebuilds-pricing-spec.md`** — canonical tier feature matrix,
   Stripe product mapping, enforcement contract. This is the source of truth
   for anything pricing-related.

If two documents disagree on pricing or tier behavior, the pricing spec wins.
If two documents disagree on tooling or environment, the tooling spec wins.
If they disagree on anything else, ask the owner in Open Questions.

**Important**: Cursor is running on the OWNER'S MAIN PC (a personal machine
that hosts everything). The spec files themselves may have been authored on
a different machine and copied over. All system checks, installs, and MCP
registrations happen on the machine where Cursor is executing — which is the
same machine where the app will be developed and (initially) hosted.

---

## What You Produce First: `/PLAN.md`

Do not write implementation code yet. Produce a single markdown file named
`PLAN.md` at the repo root, containing these sections in order:

1. **Open Questions** — every ambiguity you found across the three specs.
   Do not proceed to implementation until the owner answers these.
2. **Infrastructure Audit** — findings from introspecting the existing
   database and auth system (platform spec §2). ER diagram + KEEP / MODIFY
   / DEPRECATE / DROP for every table. Auth security checklist results.
3. **Recommended Stack Decisions** — confirm or push back on the marketing
   spec §10 stack, plus platform-specific stack additions (queue, storage,
   email, etc). Justify any additions or substitutions.
4. **Repository Layout** — proposed monorepo (or split-repo) structure with
   per-package notes. Marketing site, dashboard app, headless API, shared
   packages (design system, feature gates, DB client), demo tenant site.
5. **Multi-Tenancy Design** — schema-level tenant scoping strategy, RLS
   plan, API key model, tenant switcher UX.
6. **Design Tokens & Component Inventory** — enumerated tokens and
   primitives shared across marketing and dashboard. Note where the two
   surfaces diverge intentionally.
7. **Route Manifests** — every route in marketing, dashboard, and demo
   sites, with per-route rendering strategy and data source.
8. **Inquiry Flow Detailed Design** — data model, question bank, submission
   pipeline, email templates (marketing spec §7).
9. **Ticket Flow Detailed Design** — data model, category question banks,
   lifecycle, notification pipeline, tier-cap enforcement (marketing §7.6
   + platform §10).
10. **Pricing Page Interaction Spec** — how the service-type selector,
    tier cards, and monthly/yearly toggle animate together.
11. **Dashboard Subsystem Designs** — for each of Inventory, Orders,
    Customers, Blog, Calendar, Tickets, Settings: data model, key screens,
    validation rules, integration points.
12. **Headless API Design** — full endpoint list, auth model, versioning,
    caching, rate-limiting, CORS, SDK plan.
13. **Stripe Connect Integration Plan** — Standard vs Express recommendation,
    onboarding flow, webhook handling, refund flow, subscription billing
    (which uses non-Connect Stripe).
14. **Feature-Gate Module Design** — the single source of tier truth,
    derived from `creativebuilds-pricing-spec.md` §3. Include the
    coverage test described in that spec §8.
15. **3D & Motion Plan** — hero scene concept, secondary motion moments,
    performance budget, reduced-motion fallbacks.
16. **Content Plan** — every `TODO(content)` marker, plus the
    `CONTENT_CHECKLIST.md` outline.
17. **Demo Tenant Plan** — seed data, tenant setup, the Playwright
    acceptance test from platform spec §15.
18. **Security Plan** — outputs of the auth audit plus any additional
    hardening (CSP, dependency policy, secret rotation, PII handling).
19. **Testing Strategy** — unit, integration, E2E, accessibility,
    performance, the pricing-matrix coverage test, the demo acceptance test.
20. **Observability & Ops** — logging, error tracking, backups, alerting.
21. **Milestone Sequencing** — proposed build order broken into 6–9
    milestones with acceptance criteria for each. Suggested phasing:
    (M0) Environment bootstrap + MCP registration + Postgres migration +
         GitHub repo creation + Blender install — per tooling spec.
         Deliverable: `BOOTSTRAP_REPORT.md`.
    (M1) Infra audit (DB + auth introspection) + repo scaffold + design system.
    (M2) Marketing site + inquiry flow + pricing page.
    (M3) Auth + dashboard shell + tenant model + settings.
    (M4) Inventory + orders + Stripe Connect.
    (M5) Customers + blog + calendar + tickets.
    (M6) Headless API + demo tenant site + acceptance test.
    (M7) Hardening, a11y audit, perf audit, launch checklist.
    Adjust as you see fit but explain why.
22. **Risks & Tradeoffs** — anything the plan compromises on and why. Call
    out anywhere you disagreed with the specs.

---

## Hard Guardrails

- **Do not write implementation code until `/PLAN.md` is reviewed and approved.**
- **Do not silently swap stack choices** — flag them in Open Questions.
- **Do not modify the existing production database** during planning. Read-only
  introspection only. Migrations are proposed, not executed.
- **Do not rip-and-replace working auth** to install a fashionable alternative.
  Audit first, patch minimally, propose upgrades with justification.
- **Do not invent client names, testimonials, metrics, or product data** as if
  real. All placeholders must be flagged with `TODO(content):`.
- **Do not add dependencies** not enumerated in the specs without justifying
  them in Recommended Stack Decisions.
- **Do not skip accessibility, reduced-motion, or the demo acceptance test** —
  all three are shipping requirements, not nice-to-haves.
- **Do not scatter tier checks** across the codebase. Everything through the
  `feature-gates` module derived from the pricing spec.
- **Prefer boring, proven patterns** anywhere the spec is silent.
- **When in doubt, ask.** Owner-in-the-loop beats guess-and-refactor.

---

## Deliverable Summary

Phase 0 (M0, first task):
- `BOOTSTRAP_REPORT.md` at repo root, per tooling spec §8.
- `.cursor/mcp.json` populated and verified.
- `pro_cbdev` GitHub repo created with specs committed under `/spec`.
- SSH tunnel to Pi Postgres + official Postgres MCP working; legacy custom
  MCP scheduled for retirement.

Phase 1 (after bootstrap):
- `PLAN.md` at repo root with all 22 sections above.

Phase 2 (after plan approval, not part of this task yet):
- Marketing site live at `www.creativebuilds.dev`
- Dashboard live at `app.creativebuilds.dev`
- Demo tenant live at `demo.creativebuilds.dev` with `Demo` / `password`
- Playwright acceptance test passing in CI
- `CONTENT_CHECKLIST.md` at repo root
- README with setup instructions

---

_Start with the tooling spec. Run M0 system checks. Produce
`BOOTSTRAP_REPORT.md`. Then read the marketing, platform, and pricing specs.
Then produce `PLAN.md`. Then wait._
