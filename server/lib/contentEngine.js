/**
 * Content Engine helpers — path building, section templates, schema JSON-LD.
 */

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'item';
}

export function locationAreaSlug(locationSlug) {
  const base = String(locationSlug || '').replace(/-area$/, '');
  return `${base}-area`;
}

/** Build public path from page type + taxonomy slugs. */
export function buildSeoPath({ pageType, serviceSlug, industrySlug, locationSlug, customPath }) {
  if (pageType === 'custom' && customPath) {
    const p = String(customPath).trim();
    return p.startsWith('/') ? p : `/${p}`;
  }
  const service = slugify(serviceSlug);
  const location = locationAreaSlug(slugify(locationSlug));
  if (pageType === 'service_location') {
    return `/services/${service}/${location}`;
  }
  const industry = slugify(industrySlug);
  return `/services/${service}/${industry}/${location}`;
}

export function sectionBlueprint(pageType) {
  if (pageType === 'service_location') {
    return [
      { section_type: 'hero', heading: 'Hero', body: '' },
      { section_type: 'problems', heading: 'Local problems we solve', body: '' },
      { section_type: 'solution', heading: 'How we help', body: '' },
      { section_type: 'local', heading: 'Built for this area', body: '' },
      { section_type: 'faq', heading: 'Frequently asked questions', body: '' },
      { section_type: 'cta', heading: 'Next step', body: 'Ready to talk? Book a Discovery Call or start an inquiry.' },
    ];
  }
  if (pageType === 'custom') {
    return [
      { section_type: 'hero', heading: 'Hero', body: '' },
      { section_type: 'body', heading: 'Main content', body: '' },
      { section_type: 'cta', heading: 'Next step', body: '' },
    ];
  }
  // service_industry_location (default)
  return [
    { section_type: 'hero', heading: 'Hero', body: '' },
    { section_type: 'pain', heading: 'Industry pain points', body: '' },
    { section_type: 'local', heading: 'Local market context', body: '' },
    { section_type: 'solution', heading: 'Service solution', body: '' },
    { section_type: 'areas', heading: 'Local service areas', body: '' },
    { section_type: 'faq', heading: 'Frequently asked questions', body: '' },
    { section_type: 'related', heading: 'Related services', body: '' },
    { section_type: 'cta', heading: 'Next step', body: 'Ready to talk? Book a Discovery Call or start an inquiry.' },
  ];
}

export function defaultTitle({ serviceName, industryName, locationName, pageType }) {
  if (pageType === 'service_location') {
    return `${serviceName} in ${locationName}, Wisconsin`;
  }
  if (industryName) {
    return `${serviceName} for ${industryName} in ${locationName}`;
  }
  return serviceName || 'SEO page';
}

export function buildSchemaJson({
  schemaTypes = [],
  title,
  path,
  description,
  serviceName,
  locationName,
  faqs = [],
}) {
  const url = `https://www.creativebuilds.dev${path.startsWith('/') ? path : `/${path}`}`;
  const graph = [];

  if (schemaTypes.includes('ProfessionalService') || schemaTypes.includes('LocalBusiness')) {
    graph.push({
      '@type': schemaTypes.includes('LocalBusiness') ? 'LocalBusiness' : 'ProfessionalService',
      name: 'CreativeBuilds',
      url: 'https://www.creativebuilds.dev',
      areaServed: locationName || 'Wisconsin',
      description: description || undefined,
    });
  }

  if (schemaTypes.includes('Service')) {
    graph.push({
      '@type': 'Service',
      name: serviceName || title,
      provider: { '@type': 'Organization', name: 'CreativeBuilds' },
      areaServed: locationName || 'Wisconsin',
      url,
    });
  }

  if (schemaTypes.includes('FAQPage') && faqs.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }

  if (!graph.length) {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      url,
      description: description || undefined,
    };
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

export function wordCountFromPage(page, sections = []) {
  const parts = [page.h1, page.intro, ...(sections || []).flatMap((s) => [s.heading, s.body])];
  return parts.join(' ').split(/\s+/).filter(Boolean).length;
}
