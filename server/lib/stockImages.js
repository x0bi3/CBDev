/**
 * Stock OG images — Pexels first, Unsplash fallback.
 * Keys: PEXELS_API_KEY, UNSPLASH_ACCESS_KEY (from cbdev/.env).
 */

/**
 * @param {string} query
 * @returns {Promise<{ url: string, credit: string, provider: string, query: string } | null>}
 */
export async function findOgImage(query) {
  const q = String(query || '').trim() || 'small business website';
  const pexels = await searchPexels(q);
  if (pexels) return pexels;
  const unsplash = await searchUnsplash(q);
  if (unsplash) return unsplash;
  return null;
}

async function searchPexels(query) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  try {
    const url = new URL('https://api.pexels.com/v1/search');
    url.searchParams.set('query', query);
    url.searchParams.set('orientation', 'landscape');
    url.searchParams.set('per_page', '5');
    const res = await fetch(url, { headers: { Authorization: key } });
    if (!res.ok) {
      console.error('pexels search:', res.status);
      return null;
    }
    const data = await res.json();
    const photo = data.photos?.[0];
    if (!photo?.src) return null;
    const img =
      photo.src.large2x || photo.src.large || photo.src.original || photo.src.medium;
    if (!img) return null;
    const photographer = photo.photographer || 'Pexels';
    return {
      url: img,
      credit: `Photo by ${photographer} on Pexels`,
      provider: 'pexels',
      query,
      photographer_url: photo.photographer_url || null,
    };
  } catch (err) {
    console.error('pexels search error:', err.message);
    return null;
  }
}

async function searchUnsplash(query) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  try {
    const url = new URL('https://api.unsplash.com/search/photos');
    url.searchParams.set('query', query);
    url.searchParams.set('orientation', 'landscape');
    url.searchParams.set('per_page', '5');
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${key}` },
    });
    if (!res.ok) {
      console.error('unsplash search:', res.status);
      return null;
    }
    const data = await res.json();
    const photo = data.results?.[0];
    if (!photo?.urls) return null;
    const img = photo.urls.regular || photo.urls.full || photo.urls.raw;
    if (!img) return null;
    const name = photo.user?.name || 'Unsplash';
    return {
      url: img,
      credit: `Photo by ${name} on Unsplash`,
      provider: 'unsplash',
      query,
      photographer_url: photo.user?.links?.html || null,
    };
  } catch (err) {
    console.error('unsplash search error:', err.message);
    return null;
  }
}

/** Build a search query from page taxonomy context (keep short for stock APIs). */
export function ogQueryFromContext({ serviceName, industryName, locationName }) {
  // Prefer industry scene photos over "websites La Crosse" which returns junk.
  if (industryName) {
    const ind = String(industryName).toLowerCase();
    if (ind.includes('hvac')) return 'hvac technician working';
    if (ind.includes('plumb')) return 'plumber working';
    if (ind.includes('landscap')) return 'landscaper outdoor work';
    if (ind.includes('restaurant') || ind.includes('food')) return 'restaurant kitchen chef';
    if (ind.includes('dental') || ind.includes('dentist')) return 'dental office';
    if (ind.includes('legal') || ind.includes('law')) return 'law office desk';
    return `${industryName} professional at work`;
  }
  if (serviceName) {
    const svc = String(serviceName).toLowerCase();
    if (svc.includes('mobile')) return 'person using mobile app';
    if (svc.includes('store') || svc.includes('ecom')) return 'online shopping laptop';
    if (svc.includes('dashboard')) return 'analytics dashboard screen';
    if (svc.includes('automat')) return 'workflow automation laptop';
    return 'small business owner laptop';
  }
  if (locationName) return `${locationName} wisconsin downtown`;
  return 'wisconsin small business';
}
