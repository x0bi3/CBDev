/**
 * Content Engine AI Assist — Sam → Mark → Cody pipeline + stock OG image.
 * Uses generateJSON (OpenAI). Never auto-publishes.
 */

import { generateJSON } from './llm.js';
import { sectionBlueprint, buildSchemaJson } from './contentEngine.js';
import { findOgImage, ogQueryFromContext } from './stockImages.js';
import { resolveCaseStudiesBySlugs, caseStudyPromptPack } from './publishedCaseStudies.js';
import { query } from '../db.js';

/** Writing stages (Cody / enrich / FAQ / headings) — frontier Sol for creative copy. */
const WRITING_MODEL = 'gpt-5.6-sol';
/** Creative temperature band for Cody-led prose (0–2 scale; keep under 1.0 for coherent JSON). */
const TEMP = {
  sam: 0.4,
  mark: 0.75,
  cody: 0.95,
  enrich: 0.92,
  faq: 0.45,
  headings: 0.85,
};

/**
 * CreativeBuilds writing identity + catalog snapshot.
 * Brand authors the page; industry/location are the scene.
 * Refresh when rate-card / services catalog changes.
 */
const BRAND_AUTHOR = `
# Who writes
You are writing AS Ryan Baldwin of CreativeBuilds (Wisconsin freelance developer workshop).
First person only: I / me / let me. Tagline: You send the message. I get to work.
Same person who builds it hosts and manages it. Direct line. No agency theater, no "our experts."

# Full catalog (situational sidesell from these — invent industry-specific bridges each time)
- Websites (Presence T1–T3) → /services/websites — public face, lead capture, after-hours forms, click-to-call, SEO presence. Pricing hash /pricing#website
- Custom software / Forge → /services/custom — portals, tools, workflows when spreadsheets/SaaS fail. /pricing#software
- Web apps → /services/web-apps — same family as Forge when the page path says web-apps
- Mobile / Pocket → /services/mobile — field crews, customer apps. /pricing#mobile
- Automations → /services/automations — after-hours call/SMS routing, booking without waking the owner, copy-paste between tools, alerts. /pricing#integrations
- Stores → /services/stores — merch / payments
- Dashboards → /services/dashboards — ops visibility / reporting
- Compass (maintenance) → /services/maintenance — eng retainer AFTER something exists (bug fixes, features). NOT the same as website Upkeep.
- Audits → /audit — punch list before rebuild

# Website Upkeep (hosting) — product truth
Upkeep = hosting + SSL + backups + support TICKETS by tier (not a tip jar):
- T1 Presence/Starter: 5 tickets/mo · standard email <48h
- T2 Creator/Standard: 25 tickets/mo · priority email + phone <24h
- T3 Studio+/Growth: unlimited tickets · email + phone + SMS <24h
Upkeep ≠ Compass. Compass = separate consulting/eng retainer.
I host and maintain by default unless the package says otherwise. Client owns the work. Source code on request.
Self-updates: CMS only if scoped into the build. Otherwise changes go through hosting tickets within the monthly allowance.

# Process
Talk → Scope → Build → Launch. Discovery Call and Free Service Audits start conversation; they are NOT build steps.
Full spine: /process

# Early Bird (websites only)
First 5 website clients: 50% off build fee + 3 months free on YEARLY hosting. Not Forge/Pocket/Automations. /earlybirdcampaign

# Pricing posture
Never invent dollar amounts. Point to /pricing (with service hash when known). Personal vs Business (Business ×1.15 charm + priority benefits).

# CTAs
Scope A Project (/inquiry), Book Discovery Call (/book), Free Service Audits (/service-audits).

# Anti-slop (hard ban)
"reliable hosting is crucial/essential", "seamless", "in today's…", "whether you're…", "stands out", "next level",
"boost your", "professional edge", "vibrant community", "tailored web design solutions", delve/unlock/leverage/elevate,
em dashes, invented URLs, agency "we/our experts", one-line FAQ answers that restate the question without product facts.
Swap test: if deleting industry/location nouns still reads like any web shop, rewrite with CB catalog truths.
`.trim();

const SAM_SYSTEM = `
You are Sam, SEO Specialist for CreativeBuilds local SEO landing pages.
Write as if you know the BRAND_AUTHOR catalog (tickets, Upkeep, process, adjacent services).

Industry standard for service×industry×location pages:
- Primary keyword + local modifiers, transactional/commercial intent
- H2 outline that maps to searcher questions (not vague labels)
- Require scannable structure: bullets and numbered lists where appropriate
- local_entities_to_mention: nearby towns + industry-local realities (weather, season, after-hours demand)
- industry_search_intents: what a customer searches during an emergency or urgent job
- FAQ seeds (4): must be answerable from BRAND_AUTHOR (cost→/pricing, timeline, DIY/CMS vs tickets, hosting tickets/Upkeep).
  When primary service is websites, include one seed about "already have a site / need after-hours routing" (doors open to Automations sidesell).
  Analogous adjacent-seed for other primaries (e.g. automations page → when a public site is still broken).
- internal_link_targets: include primary service path, /pricing, /process, 1–2 adjacent catalog paths, AND every published case study path when case_studies are in context
- When case_studies are provided: treat them as E-E-A-T proof — require at least one /work/{slug} target; never invent client names outside that list
JSON only.

BRAND_AUTHOR:
${BRAND_AUTHOR}
`.trim();

const MARK_SYSTEM = `
You are Mark, Marketing Strategist for CreativeBuilds.
CreativeBuilds is the AUTHOR. Industry + location are the SCENE.
The page's primary service stays the hero conversion, but you know the FULL catalog and must pick situational sidesells.

Mandatory:
- audience_scene: one concrete after-hours or emergency moment in THIS industry + THIS location
- industry_ops_scenes: 5+ trade-specific ops moments (NOT generic web-design complaints)
- primary_offer: { service, path, how_it_catches_the_job } matching the PAGE primary service from BRAND_AUTHOR
- adjacent_offers: 1–2 OTHER catalog lines with industry-specific bridges (regenerate every run; never generic "we also do apps")
  Shape: { service, path, when, scene }
  Example pattern only: HVAC overnight → Automations after-hours routing IF they already have a site; websites page still sells websites primarily.
- offer_bridge: how primary_offer + optional adjacent_offers catch the ops scene (Ryan voice)
- lost_job_consequence, local_proof_points (5+ named towns/climate/hiring), brand_proof_points (CB truths: tickets, host-by-default, process, WI workshop)
- When case_studies are in context: case_study_proof must name each selected study + path + how it proves THIS industry/service page (honest fit — e.g. HVAC field app still proves trade ops even on a websites SIL page)
- faq_briefs: 4 items { q, must_include: string[] } grounded in BRAND_AUTHOR
  Hosting/support/updates Qs MUST must_include ticket tiers or "tickets/mo" + Upkeep
  At least one FAQ brief opens a door to an adjacent_offers path when relevant
- value_props, vs diy/templates/agencies, CTAs
JSON only.

BRAND_AUTHOR:
${BRAND_AUTHOR}
`.trim();

const CODY_SYSTEM = `
You are Cody writing AS Ryan Baldwin / CreativeBuilds. Not "AI + fill-in-the-blanks."
Quinn fails generic website-slop, nothingburger FAQs, and pages that ignore BRAND_AUTHOR.

## Brand authors every section
Use Mark primary_offer for the hero conversion. Weave adjacent_offers in related, ≥1 FAQ, and optionally one soft sentence in intro/pain closer.
Do NOT turn the page into a different service's landing page. Primary path wins; sidesells are situational.

## Voice + catalog
Follow BRAND_AUTHOR exactly (tickets, Upkeep≠Compass, process, Early Bird, first person).
Decorative flair: **bold** step titles; *italic* sparingly.

## Industry-ops first
Sell through THIS trade's lived reality in THIS location, then bridge to primary_offer (and adjacent when Mark says so).
Pain bullets = industry ops lost-job moments (+ how digital path failed), not generic outdated/slow/mobile/SEO lists.

## In-body links
2–4 [Label](/path) from allowlist across intro, solution closer, FAQ (not CTA). Include adjacent service paths when sideselling.
When case_studies are provided: MUST weave real problem/change/highlights facts and cite ≥1 by real name with [Name](/work/slug) in related and/or intro/solution closer. Never invent portfolio clients.

## Per-section
- intro: Ryan opens Mark audience_scene → primary CB offer. Optional soft adjacent hint. ≥1 link. No list.
- hero: prose promise for primary offer locally. NO bullets.
- pain: open + 4–6 "- " industry-ops bullets + closer tied to what I actually build. LIST REQUIRED.
- local: named towns + climate/season + how locals hire; Ryan/WI remote OK.
- solution: Talk/Scope/Build/Launch with **bold** titles only. Launch = I host + upkeep/tickets by default; source on request. Link [How it works](/process).
- areas: open + "- " towns + honest coverage. LIST REQUIRED.
- faq: 4 Q/A. Answer in sentence 1. Hosting/support/updates MUST cite ticket tiers (5 / 25 / unlimited) + Upkeep. ≥1 FAQ covers Mark adjacent_offers with industry-specific scene + link. Ban platitude one-liners.
- related: short prose with markdown links to primary + adjacent paths + published case studies (/work/…) + /pricing or /process.
- cta: short prose ONLY, zero markdown links (buttons exist).

## Density
hero/pain/local/solution ≥90 words; areas ≥70; intro ≥70; faq body ≥120.
Only pain/problems, solution, areas require lists (≥3).

## Ban
Platitude hosting openers, invented prices/URLs, em dashes, agency we, hand-off-source-as-default Launch, generic web-only pain lists.

JSON only.
${BRAND_AUTHOR}
`.trim();

function industryOpsExamples(industryName) {
  const ind = String(industryName || '').toLowerCase();
  if (ind.includes('hvac') || ind.includes('heating') || ind.includes('cooling') || ind.includes('air')) {
    return [
      'Friday night AC dead in a 100F house; homeowner Googles while the truck is already booked',
      'No-heat call at 11pm in January; click-to-call and after-hours form missing on mobile',
      'Seasonal install rush; website has no clear emergency vs maintenance vs install paths',
    ];
  }
  if (ind.includes('tow') || ind.includes('roadside')) {
    return [
      '3 AM Sunday popped tire on the interstate; need a truck that answers',
      'Weekend wreck; dispatcher drowning while the site still says "email us"',
    ];
  }
  if (ind.includes('plumb')) {
    return [
      'Burst pipe flooding a basement at 2 AM',
      'Water heater failure on a holiday weekend',
    ];
  }
  if (ind.includes('electric')) {
    return [
      'Power outage after a storm; urgent panel / generator calls',
      'Same-day service requests with no mobile booking path',
    ];
  }
  return [
    'After-hours customer need with no clear digital path to book or call',
    'Weekend rush where slow or vague site loses the job to whoever answers first',
  ];
}


const TEMPLATE_HEADINGS = new Set([
  'hero',
  'industry pain points',
  'local market context',
  'service solution',
  'local service areas',
  'frequently asked questions',
  'related services',
  'next step',
  'local problems we solve',
  'how we help',
  'built for this area',
  'main content',
  'body',
]);

const MIN_WORDS = {
  intro: 70,
  hero: 85,
  pain: 85,
  problems: 85,
  local: 85,
  solution: 85,
  areas: 70,
  body: 85,
  related: 45,
  cta: 30,
  faq: 120,
};

/**
 * @param {object} bundle - loadPageBundle result
 * @param {{
 *   onStage?: (stage: string) => void,
 *   includeCaseStudies?: boolean,
 *   caseStudySlugs?: string[],
 * }} [opts]
 */
export async function runContentEngineAssist(bundle, opts = {}) {
  const onStage = opts.onStage || (() => {});
  const page = bundle.page;
  const existingSections = bundle.sections || [];
  const includeCaseStudies = opts.includeCaseStudies === true || (opts.caseStudySlugs || []).length > 0;
  const caseStudies = includeCaseStudies
    ? resolveCaseStudiesBySlugs(opts.caseStudySlugs || [])
    : [];
  const caseStudyPack = caseStudyPromptPack(caseStudies);

  const context = {
    page_type: page.page_type,
    path: page.path,
    title: page.title,
    service: page.service_name || null,
    service_slug: page.service_slug || null,
    industry: page.industry_name || null,
    industry_slug: page.industry_slug || null,
    location: page.location_name || null,
    location_slug: page.location_slug || null,
    brand: 'CreativeBuilds',
    market: 'Wisconsin (and remote US)',
    industry_ops_examples: industryOpsExamples(page.industry_name),
    case_studies: caseStudyPack,
  };

  const blueprintTypes =
    existingSections.length > 0
      ? existingSections.map((s) => ({
          section_type: s.section_type,
          slot: s.section_type,
        }))
      : sectionBlueprint(page.page_type).map((s) => ({
          section_type: s.section_type,
          slot: s.section_type,
        }));

  onStage('sam');
  const seoPack = await generateJSON({
    system: SAM_SYSTEM,
    temperature: TEMP.sam,
    user: `Build an SEO pack for this CreativeBuilds page.
Include industry_search_intents (urgent/emergency queries for THIS trade) and local_entities that mix towns + climate/season for THIS trade.
Seed ops examples (adapt, do not copy blindly): ${JSON.stringify(context.industry_ops_examples)}
${caseStudies.length ? `Published case studies SELECTED by Ryan (REQUIRED proof — use exact names, paths, problem/change/highlights, and image_query for visual tone). Do not invent other clients:
${JSON.stringify(caseStudyPack, null, 2)}` : 'No case studies selected for this run.'}

Page:
${JSON.stringify(context, null, 2)}`,
    schemaHint: `{
  "primary_keyword": string,
  "secondary_keywords": string[],
  "search_intent": string,
  "industry_search_intents": string[],
  "h1_options": string[],
  "seo_title": string,
  "seo_description": string,
  "h2_outline": string[],
  "local_entities_to_mention": string[],
  "faq_seeds": [{"q": string, "why_it_matters": string}],
  "internal_link_targets": [{"label": string, "path": string}],
  "schema_hints": string[]
}`,
  });

  onStage('mark');
  const brief = await generateJSON({
    system: MARK_SYSTEM,
    temperature: TEMP.mark,
    user: `Page context (primary service is the hero conversion path):
${JSON.stringify(context, null, 2)}

Sam SEO pack:
${JSON.stringify(seoPack, null, 2)}

Seed industry ops scenes for THIS trade (expand to 5+, adapt to location, do not paste generically):
${JSON.stringify(context.industry_ops_examples)}

audience_scene MUST be an after-hours / emergency / weather ops moment for ${context.industry || 'this industry'} in ${context.location || 'this area'}.
local_proof_points MUST name towns + climate/season + how locals hire this trade.
industry_ops_scenes MUST NOT be generic website complaints.
primary_offer MUST match page service (${context.service || 'page service'} → /services/${context.service_slug || '…'}).
adjacent_offers: invent 1–2 OTHER catalog lines with THIS industry's ops bridges (fresh scenes every run).
faq_briefs: ground in BRAND_AUTHOR (tickets/Upkeep for hosting Qs; one adjacent door when relevant).
${caseStudies.length ? `case_study_proof REQUIRED using ONLY these selected studies (use problem/change/highlights as proof facts; link exact path):
${JSON.stringify(caseStudyPack, null, 2)}` : ''}`,
    schemaHint: `{
  "audience": string,
  "audience_scene": string,
  "industry_ops_scenes": string[],
  "primary_offer": {"service": string, "path": string, "how_it_catches_the_job": string},
  "adjacent_offers": [{"service": string, "path": string, "when": string, "scene": string}],
  "offer_bridge": string,
  "website_bridge": string,
  "lost_job_consequence": string,
  "angle": string,
  "positioning_one_liner": string,
  "value_props": string[],
  "local_notes": string[],
  "local_proof_points": string[],
  "brand_proof_points": string[],
  "case_study_proof": [{"name": string, "path": string, "why_it_fits": string}],
  "expertise_signals": string[],
  "faq_briefs": [{"q": string, "must_include": string[]}],
  "vs_alternatives": {"diy": string, "templates": string, "agencies": string},
  "cta_primary": string,
  "cta_secondary": string,
  "proof_notes": string
}`,
  });

  onStage('cody');
  const siblingLinks = await loadSiblingSeoLinks(page);
  const linkAllowlist = buildInlineLinkAllowlist(page, seoPack, siblingLinks, brief, caseStudies);
  let copy = await generateJSON({
    system: CODY_SYSTEM,
    temperature: TEMP.cody,
    model: WRITING_MODEL,
    user: codyUserPrompt(context, seoPack, brief, blueprintTypes, linkAllowlist),
    schemaHint: codySchemaHint(),
  });

  let sections = normalizeSections(copy.sections, blueprintTypes, existingSections);
  let faqs = mergeFaqs(copy.faqs, seoPack.faq_seeds);
  faqs = enforceBrandFaqAnswers(faqs, brief, context);
  sections = ensureFaqSection(sections, faqs);
  sections = applyBodyNormalizers(sections, context);
  copy = enforceCaseStudyMentions(copy, sections, caseStudies);
  sections = normalizeSections(copy.sections, blueprintTypes, existingSections);
  sections = applyBodyNormalizers(sections, context);

  const thin = [...findThinParts(copy.intro, sections), ...findStructureGaps(sections, copy.intro)];
  if (thin.length) {
    const enrich = await generateJSON({
      system: CODY_SYSTEM,
      temperature: TEMP.enrich,
      model: WRITING_MODEL,
      user: `These parts FAIL density, structure, industry-ops, brand grounding, or locality. Rewrite ONLY them.
Keep section_type exact. Bodies that need lists MUST include "- " bullets or "1. 2. 3." steps (≥3 items).
Write AS Ryan / CreativeBuilds using BRAND_AUTHOR + Mark primary_offer / adjacent_offers / faq_briefs.
Use Mark audience_scene, industry_ops_scenes, offer_bridge, local_proof_points, brand_proof_points.
Use Sam local_entities_to_mention and industry_search_intents.

Failures: ${JSON.stringify(thin)}

Rules when rewriting:
- reason missing_list → add the required list type for that section
- reason too_many_lists → convert to prose (no bullets/numbers)
- reason thin → expand with CB catalog specifics, keep the correct format for that section
- reason missing_industry_ops → rewrite pain/intro around trade emergency/after-hours scenes + how primary_offer catches the job; named towns required
- reason missing_locality → name towns, climate/season, local hiring habits for THIS trade
- FAQ hosting/support/updates → cite ticket tiers (5 / 25 / unlimited) + Upkeep
- Keep or add 1-2 [Label](/path) markdown links from the allowlist; weave adjacent_offers in related/FAQ when rewriting those

INLINE LINK ALLOWLIST (only these paths):
${JSON.stringify(linkAllowlist, null, 2)}

Page context:
${JSON.stringify(context, null, 2)}

Mark brief:
${JSON.stringify(brief, null, 2)}

Sam pack (entities + faq_seeds + intents):
${JSON.stringify({
  local_entities_to_mention: seoPack.local_entities_to_mention,
  industry_search_intents: seoPack.industry_search_intents,
  faq_seeds: seoPack.faq_seeds,
}, null, 2)}

Current draft for reference:
${JSON.stringify({ intro: copy.intro, sections, faqs }, null, 2)}
`,
      schemaHint: `{
  "intro": string (only if intro was thin; else omit or repeat),
  "sections": [{"section_type": string, "heading": string, "body": string}] (only failing ones required; include faq if faq failed),
  "faqs": [{"q": string, "a": string}] (required if faq failed; 4 items)
}`,
    });

    if (enrich.intro && wordCount(enrich.intro) >= MIN_WORDS.intro) {
      copy = { ...copy, intro: enrich.intro };
    }
    if (Array.isArray(enrich.sections)) {
      const byType = new Map(sections.map((s) => [s.section_type, s]));
      for (const s of enrich.sections) {
        if (!s?.section_type) continue;
        const prev = byType.get(s.section_type) || {};
        byType.set(s.section_type, {
          ...prev,
          section_type: s.section_type,
          heading: s.heading || prev.heading,
          body: s.body || prev.body,
        });
      }
      sections = blueprintTypes.map((bp, i) => {
        const filled = byType.get(bp.section_type) || {};
        const rawHeading = String(filled.heading || '').trim();
        return {
          id: existingSections[i]?.id,
          section_type: bp.section_type,
          heading: rawHeading && !isTemplateHeading(rawHeading) ? rawHeading : '',
          body: String(filled.body || '').trim(),
          sort_order: i,
        };
      });
    }
    if (Array.isArray(enrich.faqs) && enrich.faqs.length) {
      faqs = mergeFaqs(enrich.faqs, faqs);
    }
    faqs = enforceBrandFaqAnswers(faqs, brief, context);
    sections = ensureFaqSection(sections, faqs);
    sections = applyBodyNormalizers(sections, context);
  }

  // Last resort: dedicated FAQ generation if still empty / thin
  const faqSec = sections.find((s) => s.section_type === 'faq');
  if (faqSec && (!faqSec.body || wordCount(faqSec.body) < MIN_WORDS.faq)) {
    const faqOnly = await generateJSON({
      system: CODY_SYSTEM,
      temperature: TEMP.faq,
      model: WRITING_MODEL,
      user: `Write 4 FAQs as Ryan / CreativeBuilds. Full brand pack applies.

Rules:
- Answer in sentence 1 with product facts (no platitude openers).
- Hosting / support / updates / self-edit questions MUST cite Upkeep ticket tiers: T1 5/mo, T2 25/mo, T3 unlimited. Upkeep ≠ Compass.
- Follow Mark faq_briefs must_include arrays.
- ≥1 FAQ weaves an adjacent_offer with THIS industry's scene + [Label](/path) from allowlist.
- Never invent dollar amounts; link [pricing](/pricing) when cost comes up.
- 2–4 sentences per answer. At least one [Label](/path) from allowlist.

Allowlist:
${JSON.stringify(linkAllowlist, null, 2)}

Context: ${JSON.stringify(context)}
BRAND_AUTHOR (must obey):
${BRAND_AUTHOR}

Mark faq_briefs + adjacent_offers + primary_offer:
${JSON.stringify({
  faq_briefs: brief.faq_briefs,
  adjacent_offers: brief.adjacent_offers,
  primary_offer: brief.primary_offer,
  audience_scene: brief.audience_scene,
}, null, 2)}

Sam faq_seeds: ${JSON.stringify(seoPack.faq_seeds || [])}
`,
      schemaHint: `{ "faqs": [{"q": string, "a": string}] }`,
    });
    faqs = mergeFaqs(faqOnly.faqs, faqs);
    sections = ensureFaqSection(sections, faqs);
  }

  // Safety net: hosting/support/updates FAQs must cite ticket tiers
  faqs = enforceBrandFaqAnswers(faqs, brief, context);
  sections = ensureFaqSection(sections, faqs);
  sections = applyBodyNormalizers(sections, context);

  // Rewrite template / empty / slot-label headings into real H2s
  if (sections.some((s) => !s.heading || isTemplateHeading(s.heading))) {
    const headingFix = await generateJSON({
      system: CODY_SYSTEM,
      temperature: TEMP.headings,
      model: WRITING_MODEL,
      user: `Rewrite ONLY the headings for these sections into visitor-facing H2s.
Keep section_type exact. Do not return template labels (Hero, Industry pain points, etc.).
Each heading: 4-10 words, specific to ${context.service || 'this service'} / ${context.industry || 'this industry'} / ${context.location || 'this area'}.

Sections:
${JSON.stringify(sections.map((s) => ({ section_type: s.section_type, current_heading: s.heading, body_preview: String(s.body || '').slice(0, 120) })), null, 2)}
`,
      schemaHint: `{ "headings": [{"section_type": string, "heading": string}] }`,
    });
    const byType = new Map(
      (headingFix.headings || []).map((h) => [String(h.section_type || '').toLowerCase(), h.heading]),
    );
    sections = sections.map((s) => {
      const next = byType.get(String(s.section_type).toLowerCase());
      if (next && !isTemplateHeading(next)) {
        return { ...s, heading: String(next).trim() };
      }
      if (!s.heading || isTemplateHeading(s.heading)) {
        return { ...s, heading: fallbackHeading(s.section_type, context) };
      }
      return s;
    });
  }

  // Final pass: list newlines + locked Talk→Scope→Build→Launch solution
  sections = applyBodyNormalizers(sections, context);
  copy = enforceCaseStudyMentions({ ...copy, intro: copy.intro }, sections, caseStudies);
  sections = applyBodyNormalizers(copy.sections || sections, context);
  if (copy.intro) {
    copy = { ...copy, intro: sanitizeMarkdownLinks(copy.intro) };
  }

  onStage('media');
  let image = null;
  // Prefer visual tone from the first selected case study
  if (caseStudies[0]?.image_query) {
    image = await findOgImage(caseStudies[0].image_query);
  }
  const imageQuery = image
    ? caseStudies[0].image_query
    : ogQueryFromContext({
        serviceName: page.service_name,
        industryName: page.industry_name,
        locationName: page.location_name,
      });
  if (!image) {
    image = await findOgImage(imageQuery);
  }
  if (!image && page.industry_name) {
    image = await findOgImage(`${page.industry_name} technician`);
  }
  if (!image && page.service_name) {
    image = await findOgImage(`${page.service_name} small business`);
  }
  if (!image) {
    image = await findOgImage('hvac technician work');
  }

  const siblingLinksForNav = siblingLinks;
  const links = buildRequiredLinks(page, siblingLinksForNav, caseStudies);
  const schemaTypes = Array.isArray(copy.schema_types) && copy.schema_types.length
    ? copy.schema_types
    : Array.isArray(seoPack.schema_hints) && seoPack.schema_hints.length
      ? seoPack.schema_hints
      : ['ProfessionalService', 'Service', 'FAQPage'];

  faqs = mergeFaqs(faqs, parseFaqsFromSections(sections));
  const schema_json = buildSchemaJson({
    schemaTypes,
    title: copy.title || page.title,
    path: page.path,
    description: copy.seo_description || seoPack.seo_description || '',
    serviceName: page.service_name,
    locationName: page.location_name,
    faqs,
  });

  const proposal = {
    title: stripBrandSuffix(String(copy.title || page.title || '').trim()),
    h1: String(copy.h1 || seoPack.h1_options?.[0] || page.h1 || '').trim(),
    intro: sanitizeMarkdownLinks(String(copy.intro || '').trim()),
    seo_title: stripBrandSuffix(String(copy.seo_title || seoPack.seo_title || '').trim()),
    seo_description: String(copy.seo_description || seoPack.seo_description || '').trim(),
    og_image_url: image?.url || page.og_image_url || '',
    schema_types: schemaTypes,
    schema_json,
    sections,
    links,
  };

  const rationale = {
    primary_keyword: seoPack.primary_keyword || '',
    secondary_keywords: seoPack.secondary_keywords || [],
    search_intent: seoPack.search_intent || '',
    angle: brief.positioning_one_liner || brief.angle || '',
    audience: brief.audience || '',
    image_credit: image?.credit || null,
    image_provider: image?.provider || null,
    image_query: image?.query || imageQuery,
    image_url: image?.url || proposal.og_image_url || null,
    word_count: wordCount([proposal.intro, ...sections.map((s) => `${s.heading} ${s.body}`)].join(' ')),
    thin_fixed: thin,
    case_studies: caseStudies.map((c) => ({ slug: c.slug, name: c.name, path: c.path })),
  };

  onStage('done');
  return { proposal, rationale, stages: ['sam', 'mark', 'cody', 'media', 'done'] };
}

function codyUserPrompt(context, seoPack, brief, blueprintTypes, linkAllowlist) {
  return `Write FULL local SEO page copy AS Ryan / CreativeBuilds. Brand catalog authors every section. Industry + location are the scene.

Page context (PRIMARY conversion = this service path):
${JSON.stringify(context, null, 2)}

Sam SEO pack (h2_outline + local_entities + industry_search_intents + faq_seeds):
${JSON.stringify(seoPack, null, 2)}

Mark brief (REQUIRED: audience_scene, industry_ops_scenes, primary_offer, adjacent_offers, offer_bridge, local_proof_points, brand_proof_points, faq_briefs, lost_job_consequence):
${JSON.stringify(brief, null, 2)}

RULES:
- Open intro in Mark audience_scene → sell primary_offer. Soft-weave adjacent_offers once if natural (do not hijack the page).
- Pain bullets = industry_ops_scenes + how primary_offer catches the job (not generic outdated/slow/mobile/SEO lists).
- Local: named towns + climate/season + how this trade gets hired here.
- Related + ≥1 FAQ: weave adjacent_offers with THIS industry's scene + [Label](/path) to that service.
- FAQs: follow faq_briefs must_include. Hosting/support/updates MUST name ticket tiers (5 / 25 / unlimited) + Upkeep. Answer in sentence 1. No platitude openers.
- Never invent dollar amounts; point to /pricing.
- If case_studies[] is non-empty: cite each selected study by real name with [Name](/work/slug). Pull concrete facts from problem / change / highlights. Related is the natural home; intro may soft-weave. Never invent clients.

INLINE LINKS: Weave 2-4 [Label](/path) into intro, solution closer, FAQ/related. Allowlist only:
${JSON.stringify(linkAllowlist || [], null, 2)}
CTA section: prose only, zero markdown links (buttons already exist).

Fill EVERY section. Keep section_type exact. Visitor-facing headings.
Format: hero/local = prose; pain/areas = "- " bullets; solution = Talk/Scope/Build/Launch with **bold** titles; cta = prose.
Launch: I host + Upkeep tickets by default; source on request. Link [How it works](/process).

Blueprint slots:
${JSON.stringify(blueprintTypes, null, 2)}

Return faqs[] with 4 items. Do NOT put "| CreativeBuilds" in title or seo_title.
`;
}

function buildInlineLinkAllowlist(page, seoPack, siblingLinks, brief, caseStudies = []) {
  const required = buildRequiredLinks(page, siblingLinks, caseStudies);
  const fromSam = (seoPack?.internal_link_targets || [])
    .map((t) => ({
      label: String(t.label || t.path || '').trim(),
      path: String(t.path || t.target_url || '').trim(),
    }))
    .filter((t) => t.path && isAllowedInternalUrl(t.path));
  const fromAdjacent = (brief?.adjacent_offers || [])
    .map((o) => ({
      label: String(o.service || o.path || '').trim(),
      path: String(o.path || '').trim(),
    }))
    .filter((t) => t.path && isAllowedInternalUrl(t.path));
  const fromCases = (caseStudies || []).map((c) => ({
    label: c.name,
    path: c.path || `/work/${c.slug}`,
  }));
  const primaryPath = page?.service_slug
    ? { label: page.service_name || page.service_slug, path: `/services/${page.service_slug}` }
    : null;
  const catalogDefaults = [
    { label: 'Websites', path: '/services/websites' },
    { label: 'Automations', path: '/services/automations' },
    { label: 'Custom software', path: '/services/custom' },
    { label: 'Mobile apps', path: '/services/mobile' },
    { label: 'Maintenance', path: '/services/maintenance' },
    { label: 'Pricing', path: '/pricing' },
    { label: 'How it works', path: '/process' },
    { label: 'Free audit', path: '/audit' },
    { label: 'Early Bird', path: '/earlybirdcampaign' },
  ];
  const out = [];
  const seen = new Set();
  for (const item of [
    ...required.map((l) => ({ label: l.label, path: l.target_url })),
    ...(primaryPath ? [primaryPath] : []),
    ...fromCases,
    ...fromAdjacent,
    ...fromSam,
    ...catalogDefaults,
    { label: 'Example work', path: '/work' },
    { label: 'FAQ', path: '/faq' },
    { label: 'Team', path: '/team' },
  ]) {
    const path = String(item.path || '').trim();
    if (!path || seen.has(path) || !isAllowedInternalUrl(path)) continue;
    seen.add(path);
    out.push({ label: item.label || path, path });
  }
  return out.slice(0, 24);
}

/**
 * If case studies were selected but the draft never linked them, append a proof
 * sentence to related (or intro) with real names + /work paths.
 */
export function enforceCaseStudyMentions(copy, sections, caseStudies) {
  if (!caseStudies?.length) return copy;
  const blob = [
    copy?.intro,
    ...(sections || []).map((s) => `${s.heading || ''} ${s.body || ''}`),
  ].join('\n');
  const missing = caseStudies.filter((c) => {
    const path = c.path || `/work/${c.slug}`;
    return !blob.includes(path);
  });
  if (!missing.length) return { ...copy, sections };

  const proof =
    ' Proof from shipped work: ' +
    missing
      .map((c) => `[${c.name}](${c.path || `/work/${c.slug}`})`)
      .join(', ') +
    '.';

  const nextSections = (sections || []).map((s) => ({ ...s }));
  const relatedIdx = nextSections.findIndex((s) => s.section_type === 'related');
  if (relatedIdx >= 0) {
    nextSections[relatedIdx] = {
      ...nextSections[relatedIdx],
      body: `${String(nextSections[relatedIdx].body || '').trim()}${proof}`.trim(),
    };
  } else {
    copy = { ...copy, intro: `${String(copy.intro || '').trim()}${proof}`.trim() };
  }
  return { ...copy, sections: nextSections, intro: copy.intro };
}

function stripBrandSuffix(text) {
  return String(text || '')
    .replace(/\s*\|\s*CreativeBuilds\s*$/i, '')
    .trim();
}

/**
 * Turn inline "Here's how: - a - b" / "steps: 1. x 2. y" into newline list markup
 * so SeoRichBody / structure gates can see real list items.
 */
export function normalizeListMarkup(body) {
  let text = String(body || '').replace(/\r\n/g, '\n');
  // Colon then marker jammed on same line: "Here's how: - a"
  text = text.replace(/:\s*([-*•])\s+/g, ':\n$1 ');
  text = text.replace(/:\s*(\d+[.)])\s+/g, ':\n$1 ');
  // Sentence end then marker: "...rates. - Poor SEO"
  text = text.replace(/([.!;])\s+([-*•])\s+/g, '$1\n$2 ');
  text = text.replace(/([.!;])\s+(\d+[.)])\s+/g, '$1\n$2 ');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

/** Locked to real CreativeBuilds process (Talk → Scope → Build → Launch). */
export function forceProcessSolution(context, existingHeading) {
  const industry = context.industry || 'local businesses';
  const location = context.location || 'Wisconsin';
  const service = context.service || 'projects';
  const heading =
    existingHeading && !isTemplateHeading(existingHeading)
      ? existingHeading
      : `How I deliver ${service.toLowerCase()} for ${industry} in ${location}`;

  const body = `For ${industry} ${String(service).toLowerCase()} in ${location}, I use the same four steps as every CreativeBuilds job. No mystery.

1. **Talk:** You send the message or book a call. I will walk you through the process and get clear on what is broken, what done looks like, and which lane fits.
2. **Scope:** I write what is in, what is out, and a number you can live with. Ownership and access are settled before any deposit. Hosting and upkeep are assumed unless the package says otherwise.
3. **Build:** In-house work with me on it. Checkpoints you can follow: previews, demos, or dry-runs matched to the job.
4. **Launch:** We go live. Let me take care of the maintenance and upkeep. I host by default on Website Upkeep with support tickets by tier (T1 5/mo, T2 25/mo, T3 unlimited). If you want the source code, ask and I will hand it over.

See the full spine on [How it works](/process). [Book a Discovery Call](/book) and [Free Service Audits](/service-audits) start the conversation. They are not substitute build steps.`;

  return { heading, body };
}

/** Strip or demote markdown links whose href fails the allowlist (keep label text). */
export function sanitizeMarkdownLinks(text) {
  return String(text || '').replace(/\[([^\]]+)\]\((\/[^)\s]+)\)/g, (full, label, href) => {
    if (isAllowedInternalUrl(href)) return `[${label}](${href})`;
    return label;
  });
}

/** Question-gated: only hosting / support / self-edit FAQs get ticket enforcement. */
const HOSTING_FAQ_Q_RE =
  /\b(host(ing)?|upkeep|tickets?|support|maintain(enance)?|self[- ]?(edit|update)|cms|ssl|backup|who (hosts|manages)|do (you|i) host|make (changes|updates)|(update|edit|change).{0,40}\b(site|content|pages?)\b|(site|content).{0,20}\b(myself|self))\b/i;

const TICKET_FACT_RE = /\b(5\s*\/?\s*mo|25\s*\/?\s*mo|unlimited|tickets?\s*\/?\s*mo|ticket tiers?)\b/i;

const TICKET_FACT_SENTENCE =
  ' Website Upkeep includes support tickets by tier: T1 **5/mo**, T2 **25/mo**, T3 **unlimited** (Upkeep is not Compass). See [pricing](/pricing).';

const DEFAULT_HOSTING_FAQ_ANSWER =
  'Website Upkeep is how I host: SSL, backups, and support tickets by tier. ' +
  'T1 Presence/Starter includes **5 tickets/mo** (email <48h). T2 Creator/Standard includes **25 tickets/mo** (priority email + phone <24h). ' +
  'T3 Studio+/Growth includes **unlimited tickets** (email + phone + SMS <24h). ' +
  'Upkeep is not Compass; Compass is a separate eng retainer after something already exists. ' +
  'I host by default unless the package says otherwise. See [pricing](/pricing) for Personal vs Business.';

/**
 * Post-pass: hosting/support/updates FAQs must cite ticket tiers.
 * Also injects one adjacent-offer FAQ if Mark provided sidesells and none mention them.
 */
export function enforceBrandFaqAnswers(faqs, brief, context) {
  const list = Array.isArray(faqs) ? faqs.map((f) => ({ ...f })) : [];
  const industry = context?.industry || 'this trade';
  const location = context?.location || 'your area';

  for (const faq of list) {
    const q = String(faq.q || faq.question || '');
    const a = String(faq.a || faq.answer || '');
    if (!HOSTING_FAQ_Q_RE.test(q)) continue;
    if (TICKET_FACT_RE.test(a)) continue;
    // Prefer append when there is already a real answer; full replace only for empty/platitude.
    const thin = wordCount(a) < 25 || /crucial|essential|reliable hosting/i.test(a);
    faq.a = thin ? DEFAULT_HOSTING_FAQ_ANSWER : `${a.trim()}${TICKET_FACT_SENTENCE}`;
  }

  const hasHostingFaq = list.some((f) => HOSTING_FAQ_Q_RE.test(String(f.q || '')));
  if (!hasHostingFaq) {
    list.unshift({
      q: 'Do you host the site, and how do updates work?',
      a: DEFAULT_HOSTING_FAQ_ANSWER,
    });
  }

  const adjacent = Array.isArray(brief?.adjacent_offers) ? brief.adjacent_offers.filter((o) => o?.path) : [];
  if (adjacent.length) {
    const hasAdjacent = list.some((f) => {
      const blob = `${f.q || ''} ${f.a || ''}`;
      return adjacent.some((o) => blob.includes(String(o.path)) || (o.service && blob.toLowerCase().includes(String(o.service).toLowerCase())));
    });
    if (!hasAdjacent) {
      const offer = adjacent[0];
      const label = offer.service || 'related work';
      const scene = offer.scene || `after-hours ops for ${industry} in ${location}`;
      const when = offer.when || 'when the public site is already fine but routing is the gap';
      list.push({
        q: `What if I already have a site but need help with after-hours ${industry} jobs?`,
        a:
          `If ${when}, I still honor a solid public site, then sidesell the gap. ` +
          `For ${industry} in ${location}: ${scene}. ` +
          `That lane is [${label}](${offer.path}). ` +
          `Primary build on this page stays ${context?.service || 'the page service'}; we only add the adjacent piece when ops demand it.`,
      });
    }
  }

  // Keep at most 5 FAQs (4 preferred + optional adjacent inject)
  return list.slice(0, 5).map((f) => ({
    q: String(f.q || f.question || '').trim(),
    a: sanitizeMarkdownLinks(String(f.a || f.answer || '').trim()),
  })).filter((f) => f.q && f.a);
}

function applyBodyNormalizers(sections, context) {
  return (sections || []).map((s) => {
    if (s.section_type === 'solution') {
      const forced = forceProcessSolution(context, s.heading);
      return { ...s, heading: forced.heading, body: sanitizeMarkdownLinks(forced.body) };
    }
    if (s.section_type === 'faq') {
      return { ...s, body: sanitizeMarkdownLinks(s.body) };
    }
    return { ...s, body: sanitizeMarkdownLinks(normalizeListMarkup(s.body)) };
  });
}

function isAllowedInternalUrl(url) {
  const raw = String(url || '').trim();
  if (!raw.startsWith('/') || raw.startsWith('//')) return false;
  const pathOnly = raw.split('?')[0].split('#')[0];
  const segments = pathOnly.split('/').filter(Boolean);
  const exact = new Set([
    'pricing',
    'book',
    'inquiry',
    'vibe-check',
    'process',
    'work',
    'faq',
    'audit',
    'one-time',
    'contact',
    'about',
    'team',
    'services',
    'earlybirdcampaign',
  ]);
  if (segments.length === 1 && exact.has(segments[0])) return true;
  // Static service pages: /services/{slug}
  if (segments.length === 2 && segments[0] === 'services') return true;
  // Case studies: /work/{slug}
  if (segments.length === 2 && segments[0] === 'work') return true;
  // CE cluster: /services/{svc}/{loc}-area OR /services/{svc}/{ind}/{loc}-area
  if (segments[0] === 'services' && segments.length === 3) {
    return /-area$/.test(segments[2]);
  }
  if (segments[0] === 'services' && segments.length === 4) {
    return /-area$/.test(segments[3]);
  }
  return false;
}

function pricingHashForService(serviceSlug) {
  const map = {
    websites: 'website',
    'web-apps': 'software',
    software: 'software',
    mobile: 'mobile',
    automations: 'integrations',
    stores: 'website',
    dashboards: 'software',
    custom: 'software',
    maintenance: 'website',
  };
  return map[serviceSlug] || 'website';
}

async function loadSiblingSeoLinks(page) {
  if (!page?.id) return [];
  try {
    const { rows } = await query(
      `SELECT path, title, h1, service_id, industry_id, location_id
       FROM seo_pages
       WHERE status = 'published'
         AND id <> $1
         AND (
           ($2::int IS NOT NULL AND service_id = $2)
           OR ($3::int IS NOT NULL AND industry_id = $3)
           OR ($4::int IS NOT NULL AND location_id = $4)
         )
       ORDER BY updated_at DESC
       LIMIT 8`,
      [page.id, page.service_id || null, page.industry_id || null, page.location_id || null],
    );
    return rows.map((r) => ({
      label: r.h1 || r.title || r.path,
      target_url: r.path,
      rel: 'related',
    }));
  } catch (err) {
    console.error('sibling seo links:', err.message);
    return [];
  }
}

/** Fixed CTA pack + case studies + published sibling SEO pages only. Ignores LLM-invented links. */
function buildRequiredLinks(page, siblingLinks, caseStudies = []) {
  const required = [];
  if (page.service_slug) {
    required.push({
      label: `All ${page.service_name || page.service_slug}`,
      target_url: `/services/${page.service_slug}`,
    });
    required.push({
      label: `${page.service_name || 'Service'} pricing`,
      target_url: `/pricing#${pricingHashForService(page.service_slug)}`,
    });
  } else {
    required.push({ label: 'Pricing', target_url: '/pricing' });
  }
  required.push(
    { label: 'Book a Discovery Call', target_url: '/book' },
    { label: 'Free Service Audits', target_url: '/service-audits' },
    { label: 'Scope a project', target_url: '/inquiry' },
    { label: 'How it works', target_url: '/process' },
  );

  const extras = [];
  for (const c of caseStudies || []) {
    const target = String(c.path || `/work/${c.slug}`).trim();
    if (!target.startsWith('/') || target.startsWith('//')) continue;
    extras.push({ label: c.name || target, target_url: target, rel: 'related' });
  }
  for (const l of siblingLinks || []) {
    const target = String(l.target_url || l.path || '').trim();
    const label = String(l.label || target).trim();
    if (!target.startsWith('/') || target.startsWith('//')) continue;
    extras.push({ label, target_url: target, rel: 'related' });
  }

  const out = [];
  const seen = new Set();
  for (const link of [...required, ...extras]) {
    if (seen.has(link.target_url)) continue;
    seen.add(link.target_url);
    out.push({ label: link.label, target_url: link.target_url, rel: link.rel || 'related' });
  }
  return out.slice(0, 14);
}

function codySchemaHint() {
  return `{
  "title": string,
  "h1": string,
  "intro": string,
  "seo_title": string,
  "seo_description": string,
  "sections": [{"section_type": string, "heading": string, "body": string}],
  "links": [{"label": string, "target_url": string}],
  "schema_types": string[],
  "faqs": [{"q": string, "a": string}]
}`;
}

function isTemplateHeading(heading) {
  return TEMPLATE_HEADINGS.has(String(heading || '').trim().toLowerCase());
}

function fallbackHeading(sectionType, context) {
  const loc = context.location || 'Wisconsin';
  const ind = context.industry || 'local';
  const svc = context.service || 'digital';
  const map = {
    hero: `${svc} that help ${ind} companies in ${loc}`,
    pain: `What is costing ${ind} owners jobs in ${loc}`,
    problems: `What is costing owners jobs in ${loc}`,
    local: `Built around how ${loc} customers hire`,
    solution: `What we build for ${ind} teams`,
    areas: `Towns we help around ${loc}`,
    faq: `Questions ${ind} owners ask before they hire`,
    related: `Other ways we can help`,
    cta: `Ready to scope the build`,
    body: `How this works`,
  };
  return map[sectionType] || `About ${svc} in ${loc}`;
}

function wordCount(text) {
  return String(text || '')
    .split(/\s+/)
    .filter(Boolean).length;
}

function findThinParts(intro, sections) {
  const thin = [];
  if (wordCount(intro) < MIN_WORDS.intro) {
    thin.push({ field: 'intro', words: wordCount(intro), min: MIN_WORDS.intro, reason: 'thin' });
  }
  for (const s of sections || []) {
    const min = MIN_WORDS[s.section_type] ?? 60;
    const words = wordCount(s.body);
    if (words < min) {
      thin.push({
        field: 'section',
        section_type: s.section_type,
        words,
        min,
        empty: !String(s.body || '').trim(),
        reason: 'thin',
      });
    }
  }
  return thin;
}

function countListItems(body) {
  const lines = String(body || '').split('\n');
  let n = 0;
  for (const line of lines) {
    if (/^\s*[-*•]\s+\S/.test(line) || /^\s*\d+[.)]\s+\S/.test(line)) n += 1;
  }
  return n;
}

/** Only these slots require scannable lists. Others should stay mostly prose. */
const LIST_REQUIRED = new Set(['pain', 'problems', 'solution', 'areas']);
/** Sections that should avoid list-first formatting */
const PROSE_PREFERRED = new Set(['hero', 'local', 'related', 'cta', 'intro']);

const GENERIC_WEB_PAIN_RE =
  /\b(outdated|dated design|slow(?:\s+load(?:ing)?)?|not mobile|mobile.?friendly|weak seo|poor seo|search ranking|looks old|unprofessional (?:look|site)|bad design)\b/gi;
const INDUSTRY_OPS_RE =
  /\b(emergency|after[\s-]?hours|friday|saturday|sunday|3\s*a\.?m\.?|2\s*a\.?m\.?|midnight|overnight|100\s*°?\s*f|heat wave|furnace|no[\s-]?heat|ac (?:dead|out|failed)|burst pipe|flood|tow|tire|wreck|dispatch|weekend|storm|no[\s-]?show|roadside|water heater|generator)\b/gi;
const LOCALITY_RE =
  /\b(la\s*crosse|onalaska|holmen|west salem|tomah|sparta|winona|coulee|wisconsin|wi\b|county|river|valley|midwest|winter|summer|humidity|blizzard|heat)\b/gi;

function countMatches(re, text) {
  const m = String(text || '').match(re);
  return m ? m.length : 0;
}

/** True when pain reads like generic web QA with almost no trade-ops scenes. */
export function looksLikeGenericWebPainOnly(body) {
  const text = String(body || '');
  const genericHits = countMatches(GENERIC_WEB_PAIN_RE, text);
  const opsHits = countMatches(INDUSTRY_OPS_RE, text);
  return genericHits >= 3 && opsHits < 2;
}

export function looksLikeMissingLocality(body) {
  return countMatches(LOCALITY_RE, body) < 1 && wordCount(body) >= 40;
}

function findStructureGaps(sections, intro = '') {
  const gaps = [];
  if (intro && looksLikeMissingLocality(intro) && countMatches(INDUSTRY_OPS_RE, intro) < 1) {
    gaps.push({
      field: 'intro',
      reason: 'missing_industry_ops',
      hint: 'Open in a trade emergency/after-hours scene in this location, then bridge to the digital product.',
    });
  }
  for (const s of sections || []) {
    const items = countListItems(s.body);
    if (LIST_REQUIRED.has(s.section_type) && items < 3) {
      gaps.push({
        field: 'section',
        section_type: s.section_type,
        list_items: items,
        min_list_items: 3,
        reason: 'missing_list',
        hint:
          s.section_type === 'solution'
            ? 'Add numbered delivery steps (1. 2. 3. 4.)'
            : s.section_type === 'areas'
              ? 'Add "- " nearby towns'
              : 'Add "- " bullets for industry-ops lost-job moments',
      });
    }
    if (
      (s.section_type === 'pain' || s.section_type === 'problems') &&
      looksLikeGenericWebPainOnly(s.body)
    ) {
      gaps.push({
        field: 'section',
        section_type: s.section_type,
        reason: 'missing_industry_ops',
        hint:
          'Replace generic web bullets with trade ops scenes (emergency, after-hours, weather) and how the site lost the job.',
      });
    }
    if (
      (s.section_type === 'local' || s.section_type === 'areas') &&
      looksLikeMissingLocality(s.body)
    ) {
      gaps.push({
        field: 'section',
        section_type: s.section_type,
        reason: 'missing_locality',
        hint: 'Name nearby towns, climate/season, and how locals hire this trade.',
      });
    }
    // Soft flag: hero/local drowning in bullets — rewrite toward prose
    if (PROSE_PREFERRED.has(s.section_type) && items >= 3) {
      gaps.push({
        field: 'section',
        section_type: s.section_type,
        list_items: items,
        reason: 'too_many_lists',
        hint: 'Rewrite as prose paragraphs. Keep locality/expertise specifics. Do not use a bullet list.',
      });
    }
  }
  return gaps;
}

function mergeFaqs(...lists) {
  const out = [];
  const seen = new Set();
  for (const list of lists) {
    for (const item of list || []) {
      const q = String(item.q || item.question || '').trim();
      const a = String(item.a || item.answer || item.why_it_matters || '').trim();
      if (!q || !a) continue;
      const key = q.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ q, a });
    }
  }
  return out.slice(0, 5);
}

function formatFaqsBody(faqs) {
  return (faqs || [])
    .map((f) => `Q: ${f.q}\nA: ${f.a}`)
    .join('\n\n');
}

function ensureFaqSection(sections, faqs) {
  return (sections || []).map((s) => {
    if (s.section_type !== 'faq') return s;
    const fromBody = parseFaqsFromSections([s]);
    const merged = mergeFaqs(fromBody, faqs);
    if (!merged.length) return s;
    return {
      ...s,
      heading: isTemplateHeading(s.heading) ? '' : s.heading,
      body: formatFaqsBody(merged),
    };
  });
}

function normalizeSections(rawSections, blueprintTypes, existingSections) {
  const byType = new Map();
  for (const s of rawSections || []) {
    if (s?.section_type) byType.set(String(s.section_type).toLowerCase(), s);
  }
  return blueprintTypes.map((bp, i) => {
    const filled =
      byType.get(String(bp.section_type).toLowerCase()) ||
      (Array.isArray(rawSections) ? rawSections[i] : null);
    const prev = existingSections[i];
    const rawHeading = String(filled?.heading || '').trim();
    // Never keep empty or fall back to old template labels from the DB shell
    const heading = rawHeading && !isTemplateHeading(rawHeading) ? rawHeading : '';
    return {
      id: prev?.id,
      section_type: bp.section_type,
      heading,
      body: String(filled?.body || '').trim(),
      sort_order: i,
    };
  });
}

function parseFaqsFromSections(sections) {
  const faqSec = (sections || []).find((s) => s.section_type === 'faq');
  if (!faqSec?.body) return [];
  const faqs = [];
  const blocks = faqSec.body.split(/\n(?=Q:\s*)/i);
  for (const block of blocks) {
    const qm = block.match(/Q:\s*(.+?)(?:\n|$)/i);
    const am = block.match(/A:\s*([\s\S]+)/i);
    if (qm && am) {
      faqs.push({ q: qm[1].trim(), a: am[1].trim() });
    }
  }
  return faqs;
}
