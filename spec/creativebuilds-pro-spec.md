# CreativeBuilds.dev — Professional Site Build Spec

> **This is spec 1 of 3. Read `CREATIVEBUILDS_README.md` first for the full
> document set and read order. This file covers the public-facing marketing site.
> Platform / dashboard specs live in `creativebuilds-platform-spec.md`. Pricing
> and tier feature matrix live in `creativebuilds-pricing-spec.md`.**

> **Cursor Agent: Read all three specs, then produce a single `/Plan` markdown file
> describing how you will build the entire project. DO NOT write implementation
> code yet. If any requirement is ambiguous, list your open questions at the top
> of the plan before proposing your architecture. Ask before assuming.**

---

## 1. Mission Statement

Build the **primary professional face** of a senior full-stack developer's consulting
business at `www.creativebuilds.dev`. The existing creative-studio site is being
demoted to the subdomain `studio.creativebuilds.dev`. The new root site must read
unmistakably as **"this is a serious professional developer running a real business"**
— not "cool creative portfolio."

The bar: prospective clients (from solo founders to procurement teams) should land
here and immediately trust that this developer can be handed money and shipped
software.

---

## 2. Positioning

- **Who:** Independent senior developer, generalist by design.
- **What they ship:** Websites, custom software, mobile apps, integrations, MVPs,
  and technical consulting.
- **Angle:** "One highly skilled builder who can handle the full stack across
  problem domains" — a premium alternative to hiring three specialists or a
  bloated agency.
- **Tone of voice:** Confident, direct, engineering-forward. Fewer adjectives,
  more concrete outcomes. Absolutely no "we craft digital experiences" cliches.
- **Not:** A creative studio, a design agency, a personal blog, or a rainbow
  playground portfolio. All of those signals belong on the `studio.` subdomain.

---

## 3. Target Audience

Broad "hire-me" funnel with three implicit tiers:

1. **Founders / small teams** — need an MVP, a marketing site, or a specific
   feature shipped fast.
2. **Established businesses** — need custom software, internal tools, mobile apps,
   or systems integrations by a trusted external builder.
3. **Peer devs / agencies** — occasionally want to subcontract or collaborate.

The site does not need three separate funnels — one strong funnel that speaks to
"serious builder for hire" covers all three.

---

## 4. Primary Conversion Goal

Single north-star action: **get a qualified project inquiry into the inbox.**

Two entry points to that goal, both prominent above the fold:

- **Book a discovery call** (calendar embed, e.g. Cal.com or Calendly)
- **Submit a project inquiry** — a **two-stage dynamic form** (see §7)

Both should end at the same "we'll be in touch" confirmation, and both should feed
the same downstream notification pipe.

---

## 5. Site Architecture

### Domain layout

| URL                                  | Purpose                                        |
| ------------------------------------ | ---------------------------------------------- |
| `www.creativebuilds.dev`             | THIS project. Professional business site.      |
| `app.creativebuilds.dev`             | Authenticated dashboard (platform spec).       |
| `demo.creativebuilds.dev`            | Live demo client site (platform spec).         |
| `studio.creativebuilds.dev`          | Existing creative site, relocated. Out of scope. |

### The "Studio →" link — deliberately discreet

A small `Studio →` link belongs somewhere on the pro site but must NOT compete
with the professional messaging. Requirements:

- Placement in the footer, or as a tiny top-right corner element in muted text.
- No hover animation that draws the eye, no accent color, no icon larger than
  the surrounding text.
- Renders in `text-muted` token, becomes `text-primary` only on hover/focus.
- Never appears in the primary nav, never in the hero, never near a CTA.
- Anyone specifically looking for it will find it in seconds. No one glancing
  at the page as a prospective client should notice it exists.

### Route map (proposed — Cursor may refine in `/Plan`)

- `/` — Home
- `/services` — Service offerings
- `/pricing` — Interactive multi-service pricing table (§7.5)
- `/work` — Case studies index
- `/work/[slug]` — Individual case study pages
- `/about` — Bio, credentials, tech capabilities
- `/process` — How engagements run
- `/inquiry` — Two-stage inquiry flow for NEW prospects (§7)
- `/inquiry/thanks` — Confirmation page
- `/tickets/new` — Support ticket flow for EXISTING clients (§7.6) — auth-gated
- `/book` — Discovery-call scheduler
- `/contact` — Low-friction fallback contact info
- `/login`, `/logout`, `/signup` — Auth entry points (delegated to existing infra)
- `/legal/privacy`, `/legal/terms` — Boilerplate legal stubs

### Global navigation

The primary nav must accommodate two states cleanly:

**Unauthenticated visitor:**
- Logo (links home)
- Services / Work / Pricing / About / Process (nav links)
- `Log in` (secondary button, right side)
- `Start a project` (primary CTA button, right side, links to `/inquiry`)

**Authenticated client:**
- Logo (links home)
- Services / Work / Pricing / About / Process (same links, still accessible)
- `Submit a Ticket` icon button (right side, opens `/tickets/new`)
- `Dashboard` button (right side, links to `app.creativebuilds.dev`)
- User avatar dropdown (right side) with: Profile Settings, Billing,
  Switch Tenant (if user manages >1 site), Log out

Both states must maintain the same visual weight and layout — the professional
feel should not degrade for logged-in users.

---

## 6. Page-by-Page Information Architecture

### 6.1 Home (`/`)

Above the fold:
- Full-viewport hero with **3D scene** as the centerpiece (see §10). Not decorative
  — must reinforce "I build real technical things."
- Single-sentence value proposition. Sub-line clarifying scope.
- Two primary CTAs: **Book a call** / **Start a project inquiry**.

Below the fold, in order:
1. **Trust strip** — logos of past clients or tech stack marks. TODO placeholder.
2. **Services summary** — 3–4 offering tiles linking to `/services`.
3. **Featured case studies** — 2–3 cards linking to `/work/[slug]`.
4. **Capabilities overview** — tech stack matrix / "what I can build" grid.
5. **Process teaser** — condensed 3–4 step version of `/process`.
6. **Testimonials** — carousel or stacked quotes. TODO placeholders.
7. **Closing CTA band** — restate discovery call + inquiry actions.

### 6.2 Services (`/services`)

- Offering categories that mirror the inquiry-form categories (§7):
  1. **Website & Marketing Sites**
  2. **Custom Software / Web Apps**
  3. **Mobile Apps**
  4. **Integrations & Automation**
  5. **Technical Consulting / Fractional CTO**
- Each offering gets: outcome-focused summary, typical deliverables, sample
  timeline, "who this is for," and a category-scoped CTA to `/inquiry?category=...`.

### 6.3 Work (`/work` + `/work/[slug]`)

- Index page: filterable grid of case studies (by category + tech).
- Detail page structure per case study:
  - Client + project name
  - Problem / context
  - Approach
  - Solution
  - Outcome (metrics wherever possible)
  - Tech stack used
  - Media gallery (screenshots / short clips / 3D renders where relevant)
  - Related case studies + CTA band
- Ship with **3 placeholder case studies** covering different service categories.

### 6.4 About (`/about`)

- Bio (professional, first-person, credibility signals).
- Timeline / experience highlights.
- **Capabilities matrix** — categorized tech stack: languages, frameworks,
  platforms, cloud, databases, DevOps, mobile, AI/ML tooling.
- Speaking / writing / OSS if applicable — TODO placeholder section.
- Photo or tasteful visual identity element.

### 6.5 Process (`/process`)

Standard-but-clear engagement flow, e.g.:
1. Discovery call
2. Scoped proposal
3. Kickoff & planning
4. Iterative build with checkpoints
5. Launch & handoff
6. Post-launch support options

Each step: what happens, what the client provides, what they receive.

### 6.6 Inquiry (`/inquiry`) — see dedicated §7

### 6.6b Pricing (`/pricing`) — see dedicated §7.5

### 6.6c Tickets (`/tickets/new`) — see dedicated §7.6

### 6.7 Book (`/book`)


Embedded scheduler (Cal.com preferred for developer-friendliness, Calendly
acceptable). Wrap the embed in the site chrome so it doesn't feel like a bounce.

### 6.8 Contact (`/contact`)

Email address, professional social links (GitHub, LinkedIn, X/Bluesky), response
time expectation. This is the escape hatch for people who hate forms.

### 6.9 Auth pages (`/login`, `/signup`)

Delegate to whatever auth infrastructure CreativeBuilds already runs on. Style
the hosted pages (or custom wrappers) to match the dark-technical system. If
the existing auth doesn't support styling, wrap it in a themed shell. See
security requirements in the platform spec.

---

## 7. The Two-Stage Dynamic Inquiry Flow

This is a **hero feature** of the site and needs to be built with care.

### Stage 1: Category Selection + Brief Overview

- Multi-select category tiles (matching the service categories in §6.2).
- Free-form brief overview textarea ("In a sentence or two, what are you trying
  to build?").
- Basic identity fields: name, email, company (optional), preferred contact.
- Budget range selector (predefined bands, plus "not sure yet").
- Timeline selector (ASAP / 1–3mo / 3–6mo / exploratory).

### Stage 2: Dynamic Category-Specific Questionnaire

Based on the categories selected in Stage 1, dynamically compose a follow-up
questionnaire. Each category contributes its own question block. Blocks stack in
the order the user selected them.

**Question bank per category** (Cursor: expand these in `/Plan`, then confirm
with the owner before building):

- **Website & Marketing Sites**
  - What kind of site (marketing, e-commerce, docs, other)?
  - Existing site to replace or greenfield?
  - CMS needs?
  - Estimated page count?
  - Design assets available?
- **Custom Software / Web Apps**
  - Users: internal, customer-facing, both?
  - Auth requirements?
  - Integrations required?
  - Data sensitivity / compliance needs (SOC2, HIPAA, PCI, none)?
  - Expected user scale at launch?
- **Mobile Apps**
  - Platforms: iOS, Android, both?
  - Native, cross-platform, or web-wrapper acceptable?
  - Backend exists or needs to be built?
  - App-store publishing responsibility?
- **Integrations & Automation**
  - Systems involved?
  - Event triggers / schedule?
  - Data volume?
  - Failure-handling expectations?
- **Technical Consulting / Fractional CTO**
  - Team size?
  - Current stack?
  - Primary problem area (architecture, hiring, code review, roadmap)?
  - Time commitment expected?

### Behavior requirements

- Progress indicator showing stage 1 → stage 2 → confirmation.
- Client-side validation with clear inline errors.
- Auto-save partial submissions to `localStorage` so accidental refresh doesn't
  nuke the user's input.
- On submit, POST to a serverless endpoint that:
  - Emails the developer a formatted summary.
  - Sends the submitter a confirmation email.
  - Optionally forwards to a CRM webhook (design as pluggable).
- Bot mitigation: honeypot field + rate limit + optional Turnstile/hCaptcha.
- Fully keyboard navigable and screen-reader labeled (§11).

---

## 7.5 Interactive Multi-Service Pricing Table (`/pricing`)

The pricing page is a **hero interactive moment**, not a static table. It must:

### Service-type selector (top of page)

A segmented control or tabbed selector with these service types:

- **Website** (fully populated with real tiers — see `creativebuilds-pricing-spec.md`)
- **Custom Software** (placeholder — display "Coming soon" state)
- **Mobile App** (placeholder — display "Coming soon" state)
- **Integrations & Automation** (placeholder — display "Coming soon" state)
- **Consulting / Fractional CTO** (placeholder — display "Coming soon" state)

Switching service type must animate the tier cards below (crossfade or slide,
not jarring). Placeholder states show a stylized "Get in touch for pricing"
card with a `/inquiry?category=xxx` CTA.

### Tier cards (per selected service type)

For Website: render three tier cards — Tier 1, Tier 2, Tier 3 — pulled from the
source-of-truth defined in `creativebuilds-pricing-spec.md`. Each card:

- Tier name + tagline
- Price with monthly/yearly toggle (animated when switched)
- Feature checklist with clear  /  affordances
- "Platform fee" line item for tiers that have one
- CTA button: `Start with [Tier Name]` → `/inquiry?category=website&tier=X`
- Recommended tier gets a subtle highlight (elevated card + accent border,
  no gaudy "MOST POPULAR" banner)

### Animation and interaction

- Cards animate on scroll-in (staggered fade + rise).
- Monthly ↔ yearly toggle uses smooth number tweening for price changes.
- Hover on a feature row highlights the same feature across all three cards
  for easy comparison.
- Optional: a compact comparison table below the cards for keyboard/screen-reader
  users and for anyone who prefers dense data.
- Fully responsive: cards stack on mobile, remain scannable, comparison table
  reflows to horizontally scrollable.

### Copy tone

Price honestly. No fake urgency, no "was $X now $Y" nonsense. State the platform
fee plainly. Explain what a platform fee IS in a tooltip for non-technical
visitors.

---

## 7.6 Support Ticket Flow (`/tickets/new`) — for EXISTING clients only

This is a **separate system** from the prospect inquiry form. Different user,
different intent, different data model.

### Access

- Auth-gated. Unauthenticated users hitting `/tickets/new` get redirected to
  `/login?redirect=/tickets/new`.
- Nav entry (`Submit a Ticket` button) only renders for authenticated clients.

### Ticket categories

- **Content update** ("change this text / image / product")
- **Bug report** ("something is broken on my site")
- **New feature request** ("can we add X")
- **Billing / account question**
- **Other**

### Fields

- Category selector (above list).
- Subject (short summary).
- Description (rich text — same editor as the blog CMS from platform spec).
- Attachments (screenshots, files — up to 10MB total).
- Priority (Low / Normal / High) — enforced against tier request cap.
- Which site does this affect? (dropdown of tenants the user owns).

### Tier enforcement

- Tier 1: 5 open ticket requests max per billing period.
- Tier 2: 25 open ticket requests max per billing period.
- Tier 3: unlimited.
- When cap reached: form disables submit and shows upgrade CTA.
- Enforcement is a shared concern with the platform spec — implement once in
  a shared `feature-gates` module.

### Ticket lifecycle

- States: `Open` → `In Progress` → `Awaiting Client` → `Resolved` → `Closed`.
- Email notifications on state change (both directions).
- Client can view all their tickets in the dashboard (platform spec §Tickets).

---

## 8. Visual Design System

### Aesthetic direction

**Dark technical.** Reference vibes: Supabase, Railway, Vercel, Linear.
Not gamer-dark, not cyberpunk. Restrained, engineering-refined.

### Color guidance

- Deep neutral base (near-black, not pure `#000`).
- One saturated accent for CTAs and key highlights.
- Elevated surface tones for cards and modals.
- Subtle glow / gradient treatments allowed as accents, not backgrounds.
- Establish a documented palette (Tailwind config) with named tokens:
  `bg-base`, `bg-elevated`, `bg-inset`, `text-primary`, `text-muted`,
  `border-subtle`, `accent`, `accent-muted`, `danger`, `success`.

### Typography

- One geometric sans for UI + one monospace for accents / code / metadata.
- Recommended pairings for Cursor to evaluate: Inter + JetBrains Mono, Geist Sans
  + Geist Mono, Söhne + Berkeley Mono (if licensing permits).
- Establish a modular type scale; document heading levels and their usage.

### Layout system

- Grid-based with generous whitespace.
- Section-level design language may vary intentionally — see §9 responsiveness note.
- Consistent 8px spacing base.

### Component library

Cursor should scaffold reusable primitives before building pages:
`Button`, `Link`, `Card`, `Badge`, `Tag`, `Input`, `Textarea`, `Select`,
`Radio`, `Checkbox`, `Toggle`, `Modal`, `Toast`, `Accordion`, `Tabs`,
`Tooltip`, `NavBar`, `Footer`, `SectionHeader`, `MetricStat`, `TechBadge`,
`CaseStudyCard`, `ServiceCard`, `TestimonialQuote`, `CTABand`.

---

## 9. Motion, 3D & Section Personality

### 3D requirements

- Hero features a real 3D scene rendered in-browser. Concept guidance for Cursor
  to propose in `/Plan`: an abstract technical object (wireframe blueprint,
  modular geometry, orbiting mesh) — something that reads as "engineering
  artifact" rather than "art piece."
- 3D must be **performance-budgeted**: LCP under 2.5s on mid-tier laptop,
  graceful downgrade to a static poster image on `prefers-reduced-motion` or
  low-power devices.
- Consider secondary lightweight 3D moments elsewhere (e.g. About page has a
  small rotating tech-logo constellation).

### Scroll & interaction motion

- Scroll-linked reveals with subtle parallax on major section transitions.
- Sticky-section pinning for the process/services storytelling moments.
- Cursor-follow effects on interactive elements where they add clarity, not
  where they add noise.
- Micro-interactions on buttons, cards, and form controls — restrained, snappy
  easing, no bouncy overshoots.
- All motion respects `prefers-reduced-motion`.

### Section responsiveness

- Different sections may adopt different responsive personalities: e.g. the
  services grid collapses to a swipeable carousel on mobile; the case-study
  hero switches from split-column to stacked with a full-width media block; the
  capabilities matrix reorganizes from grid to categorized accordion on small
  screens.
- Design mobile-first for interactivity, but design desktop-first for the
  showcase moments — Cursor should call out this tension in `/Plan` and
  propose a reconciliation strategy per section.

---

## 10. Tech Stack

### Recommended (Cursor may propose alternatives with justification in `/Plan`)

- **Framework:** Next.js 14+ (App Router) + TypeScript.
- **Styling:** Tailwind CSS + CSS variables for theming tokens.
- **3D:** React Three Fiber + Drei + Three.js. Use `@react-three/postprocessing`
  for bloom / DOF only if perf budget allows.
- **Motion:** Framer Motion for React-driven transitions. GSAP + ScrollTrigger
  for scroll-orchestrated sequences.
- **Forms:** React Hook Form + Zod for schema-driven validation shared client
  and server.
- **CMS:** Case studies and copy in MDX under `content/` for v1. Leave a clean
  seam for swapping to Sanity/Contentlayer later.
- **Backend:** Next.js Route Handlers for form submission + email dispatch via
  Resend (preferred) or Postmark.
- **Analytics:** Plausible or Vercel Analytics — privacy-friendly, no cookie
  banner required.
- **Hosting:** Vercel (assumed; call out any concerns in `/Plan`).
- **Booking:** Cal.com embed.
- **Bot protection:** Cloudflare Turnstile.

### Repo hygiene

- Strict TypeScript, ESLint, Prettier, Husky pre-commit with lint + typecheck.
- Conventional commits.
- README with local dev, env vars, deployment steps.
- `.env.example` documenting all required secrets.
- Component-level and integration tests for the inquiry flow (Vitest + Playwright).

---

## 11. Accessibility

- Target **WCAG 2.2 Level AA**.
- Every interactive element keyboard reachable with visible focus rings that
  survive the dark theme.
- Semantic HTML landmarks throughout.
- All 3D and motion respects `prefers-reduced-motion` — provide static fallbacks,
  not just paused animations.
- Form fields fully labeled with `label for=`, aria-describedby for helper text,
  aria-invalid on errors, error summary at top of form on submit failure.
- Color contrast documented against tokens in the design system.
- Test with keyboard-only navigation and one screen reader before shipping.

---

## 12. Performance

- Lighthouse targets on mobile: Performance ≥ 85, Accessibility ≥ 95,
  Best Practices ≥ 95, SEO ≥ 95.
- LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms on the Home page over 4G throttling.
- Route-level code splitting; lazy-load 3D bundle behind an intersection observer.
- Preload critical fonts; subset where possible.
- Image pipeline: Next/Image with AVIF/WebP.
- Bundle budget: initial JS ≤ 200KB gzipped excluding 3D chunk.

---

## 13. SEO & Metadata

- Per-page `<title>` and meta description authored, not autogenerated.
- Open Graph + Twitter card images for every route (dynamic OG generation
  acceptable via `next/og`).
- JSON-LD `Person` and `ProfessionalService` structured data on relevant pages.
- `sitemap.xml` and `robots.txt` generated at build time.
- Canonical URLs configured to prevent `www` / apex duplication.

---

## 14. Content & Placeholder Strategy

The owner does NOT have finalized copy or assets yet. Cursor must:

- Write **professional-quality placeholder copy** in the required voice for every
  section — not lorem ipsum, not generic marketing pabulum.
- Mark all placeholder content with a `{/* TODO(content): ... */}` comment so
  the owner can grep for `TODO(content)` and see everything that needs owner
  input.
- Use tasteful placeholder imagery via a documented source (e.g. abstract
  gradients, generated SVGs, or clearly-labeled stock).
- Ship the 3 placeholder case studies with realistic but clearly-fictitious
  client names (e.g. "Northwind Logistics", "Helios Health") and an explicit
  `TODO(content): replace with real case study` marker.
- Compile a `CONTENT_CHECKLIST.md` at the repo root listing every piece of copy,
  image, logo, and testimonial the owner must supply before public launch.

---

## 15. Out of Scope for v1

- The `studio.creativebuilds.dev` migration (separate project).
- Payment / invoicing integration.
- Client portal / project dashboard.
- Full CMS backend (MDX is v1; migration path is future work).
- Multilingual support.
- Newsletter platform (leave a hook, don't build it).

---

## 16. What Cursor's `/Plan` Deliverable Must Contain

Produce a single markdown file named `PLAN.md` at the repo root. It must contain,
in this order:

1. **Open Questions** — anything ambiguous in this spec that needs owner input
   before implementation begins. Do not proceed past `/Plan` without answers to
   blocking questions.
2. **Recommended Stack Decisions** — confirm or push back on §10, with reasoning.
3. **Repository Layout** — proposed directory tree with brief per-directory notes.
4. **Design Tokens & Component Inventory** — enumerated list of tokens, primitives,
   and composite components with dependency order.
5. **Route Manifest** — every route from §5, with per-route rendering strategy
   (static, ISR, dynamic) and data source.
6. **Inquiry Flow Detailed Design** — full data model, question-bank schema,
   validation rules, submission pipeline, and email templates.
7. **3D & Motion Plan** — concept description, asset pipeline, performance
   budget, and reduced-motion fallbacks per surface.
8. **Content Plan** — every TODO(content) marker, plus the CONTENT_CHECKLIST outline.
9. **Testing Strategy** — unit, integration, E2E, accessibility, performance.
10. **Milestone Sequencing** — proposed build order broken into 4–6 milestones
    with acceptance criteria for each.
11. **Risks & Tradeoffs** — anything the plan compromises on and why.

---

## 17. Guardrails for Cursor

- **Do not write implementation code until `/Plan` is reviewed and approved.**
- **Do not silently swap stack choices** — flag them in the Open Questions.
- **Do not invent client names, testimonials, or metrics** as if they were real
  — placeholders must be obviously placeholder-flagged.
- **Do not add dependencies not enumerated in §10** without justifying them in
  the Recommended Stack Decisions section.
- **Do not skip accessibility or reduced-motion requirements** — these are
  non-negotiable and must be validated per component, not just in review.
- **Prefer boring, proven patterns** over clever ones anywhere the spec is
  silent. This is a business site, not a tech demo.

---

_End of spec. Cursor: produce `PLAN.md` now._
