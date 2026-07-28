/**
 * Published marketing case studies (/work/{slug} on www.creativebuilds.dev).
 * Keep in sync with apps/marketing/src/content/site.ts → PORTFOLIO.
 * Selected studies are injected into Content Engine AI Assist as proof context.
 */

export const PUBLISHED_CASE_STUDIES = [
  {
    slug: 'lakeview-landscape',
    name: 'Lakeview Lawn & Landscape',
    path: '/work/lakeview-landscape',
    tag: 'Local service, 2024',
    category: 'Business website',
    role: 'Design & build',
    stack: 'Next.js, Stripe, Postgres',
    summary:
      'Website and online booking for a Wisconsin landscaping crew: service areas, seasonal packages, and deposits without phone tag.',
    problem:
      'They lived off referrals and a Facebook page. Quotes happened over text. Spring rush meant missed calls and double-booked crews.',
    change:
      'Built a fast mobile site with service-area pages, a booking form tied to their calendar, and Stripe deposits for install jobs.',
    highlights: [
      'Online booking live before spring season',
      '40% of new jobs now start from the site',
      'Owner updates services without calling us',
    ],
    priceNote: 'Hosted on Studio tier + $1,200 custom booking build',
    image_query: 'landscaping crew lawn wisconsin outdoor service',
    industries: ['landscap', 'lawn', 'outdoor', 'garden'],
    services: ['websites', 'stores'],
  },
  {
    slug: 'ember-oak-bakery',
    name: 'Ember & Oak Bakery',
    path: '/work/ember-oak-bakery',
    tag: 'Retail, 2023',
    category: 'Online ordering',
    role: 'Full stack',
    stack: 'React, Node, Stripe',
    summary:
      'Weekend pre-order site for a small bakery. Pick your pickup slot, pay ahead, kitchen gets a clean daily list.',
    problem:
      'Instagram DMs for custom orders were a mess. They turned away business because they could not track what was owed or when.',
    change:
      'Simple catalog, pickup scheduling, and a kitchen dashboard that prints the day\'s run sheet at 6 AM.',
    highlights: [
      'Sold out weekends without DM chaos',
      'Cut order mistakes to near zero',
      'Works on a phone in the kitchen',
    ],
    priceNote: '$19.99/mo upkeep + $850 ordering setup',
    image_query: 'bakery bread kitchen counter retail shop',
    industries: ['baker', 'food', 'retail', 'restaurant', 'cafe'],
    services: ['websites', 'stores', 'web-apps'],
  },
  {
    slug: 'pitchlist',
    name: 'PitchList',
    path: '/work/pitchlist',
    tag: 'Side project, 2024',
    category: 'Web app MVP',
    role: 'Full build',
    stack: 'Next.js, Postgres, Resend',
    summary:
      'Lightweight CRM for independent baseball coaches: roster, parent contacts, and game-day texts from one place.',
    problem:
      'A coach friend tracked 30 families in Notes and group texts. Parents missed schedule changes; he spent Sunday nights copying numbers.',
    change:
      'Scoped a focused MVP: roster import, templated SMS/email blasts, and a shareable schedule link parents could bookmark.',
    highlights: [
      'Shipped in six weeks on a side-project budget',
      'One coach to three teams using it same season',
      'Built to grow if he wants subscriptions later',
    ],
    priceNote: '$2,400 flat for MVP scope',
    image_query: 'baseball coach clipboard youth sports field',
    industries: ['sport', 'coach', 'fitness'],
    services: ['web-apps', 'custom', 'automations'],
  },
  {
    slug: 'ridgeline-hvac',
    name: 'RidgeLine HVAC',
    path: '/work/ridgeline-hvac',
    tag: 'Trades, 2023',
    category: 'Field mobile app',
    role: 'Design & build',
    stack: 'React Native, Postgres',
    summary:
      'Checklist app for HVAC techs: photos, parts used, customer sign-off, and invoice data synced before they leave the driveway.',
    problem:
      'Paper forms came back incomplete. Office staff retyped everything. Invoices lagged days behind the job.',
    change:
      'Offline-friendly mobile forms that sync when they hit LTE, with admin view for dispatch and billing.',
    highlights: [
      'Same-day invoicing on most jobs',
      'Office cut re-entry time by ~8 hrs/week',
      'Works in basements with bad signal',
    ],
    priceNote: 'Starting at $89.99 for scoped mobile module; full build quoted separately',
    image_query: 'hvac technician service call furnace repair',
    industries: ['hvac', 'heating', 'cooling', 'air', 'furnace', 'plumb', 'electric', 'trade'],
    services: ['mobile', 'custom', 'web-apps', 'websites'],
  },
  {
    slug: 'legacy-tables',
    name: 'Legacy Tables',
    path: '/work/legacy-tables',
    tag: 'Product launch, 2025',
    category: 'Landing page + waitlist',
    role: 'Design & build',
    stack: 'Next.js, Postgres, Tailwind',
    summary:
      'Pre-launch funnel site for Legacy II professional arm wrestling tables. Email and phone waitlist capture tied to Postgres, built for conversion.',
    problem:
      'The product was ready but had no digital presence. Needed a fast, polished site that could collect interest, build a list, and look like a real brand before inventory shipped.',
    change:
      'Single-page funnel with waitlist form, phone capture, and admin database view. Deployed on a Raspberry Pi server with PM2 and rsync. Clean, product-focused design.',
    highlights: [
      'Live waitlist collecting leads before first unit shipped',
      'Self-hosted on dedicated hardware, no recurring platform fees',
      'Fast load: static Next.js export with zero bloat',
    ],
    priceNote: 'Starter upkeep ($9.99/mo) + $250 build',
    image_query: 'arm wrestling table sports product launch',
    industries: ['sport', 'product', 'manufactur', 'retail'],
    services: ['websites'],
  },
  {
    slug: 'nitro-trader',
    name: 'Nitro Trader / Launcher',
    path: '/work/nitro-trader',
    tag: 'Trading platform, 2024',
    category: 'Full custom web app',
    role: 'Full build',
    stack: 'Python, WebSocket, React, Postgres',
    summary:
      'Real-time trading signal platform with WebSocket feeds, strategy management, risk controls, and a desktop launcher for configuration.',
    problem:
      'Traders needed a way to receive and act on signals from multiple channels in real-time. Existing tools were fragmented: Discord for alerts, spreadsheets for tracking, manual execution for trades.',
    change:
      'Built a dual-server architecture (HTTP API + WebSocket) with user sessions, channel subscriptions, strategy templates (trailing stops, take-profit combos), risk parameter management, and simulation mode. Desktop launcher handles config and updates.',
    highlights: [
      'Sub-second signal delivery via WebSocket',
      'Six strategy types with full customization',
      'Simulation mode for risk-free testing before going live',
    ],
    priceNote: 'Full Custom tier: scoped and quoted after discovery',
    image_query: 'trading dashboard charts financial software screen',
    industries: ['trad', 'financ', 'fintech'],
    services: ['custom', 'web-apps', 'dashboards'],
  },
  {
    slug: 'creative-studio',
    name: 'Creative Studio',
    path: '/work/creative-studio',
    tag: 'Internal product, 2024',
    category: 'SaaS platform',
    role: 'Founder & lead',
    stack: 'React, Vite, Node, Postgres',
    summary:
      'The CreativeBuilds client platform: content management, blog publishing, admin dashboard, inquiry management, and booking system in one interface.',
    problem:
      'Managing client sites, content, inquiries, and scheduling required jumping between tools. No single system connected client-facing features to backend operations.',
    change:
      'Unified platform with role-based auth, rich text blog editor (TipTap), admin dashboard for inquiries and analytics, calendar booking with availability slots, and API routes for client site integration.',
    highlights: [
      'Single login for all CreativeBuilds operations',
      'Blog publishing with live preview and SEO fields',
      'Inquiry flow from submission to project kickoff',
    ],
    priceNote: 'Internal product, not client-billed',
    image_query: 'admin dashboard content management software dark ui',
    industries: ['saas', 'agency', 'software'],
    services: ['custom', 'web-apps', 'dashboards'],
  },
];

/** Resolve selected slugs to full case-study records (order preserved). */
export function resolveCaseStudiesBySlugs(slugs) {
  const list = Array.isArray(slugs) ? slugs.map((s) => String(s).trim()).filter(Boolean) : [];
  const bySlug = new Map(PUBLISHED_CASE_STUDIES.map((c) => [c.slug, c]));
  return list.map((slug) => bySlug.get(slug)).filter(Boolean);
}

export function listPublishedCaseStudies() {
  return PUBLISHED_CASE_STUDIES.map((c) => ({
    slug: c.slug,
    name: c.name,
    path: c.path,
    tag: c.tag,
    category: c.category,
    role: c.role,
    stack: c.stack,
    summary: c.summary,
    problem: c.problem,
    change: c.change,
    highlights: c.highlights,
    priceNote: c.priceNote,
    image_query: c.image_query,
    industries: c.industries,
    services: c.services,
  }));
}

/** Compact pack for LLM prompts (full proof narrative). */
export function caseStudyPromptPack(studies) {
  return (studies || []).map((c) => ({
    slug: c.slug,
    name: c.name,
    path: c.path,
    url: `https://www.creativebuilds.dev${c.path}`,
    tag: c.tag,
    category: c.category,
    role: c.role,
    stack: c.stack,
    summary: c.summary,
    problem: c.problem,
    change: c.change,
    highlights: c.highlights,
    priceNote: c.priceNote,
    image_query: c.image_query,
  }));
}
