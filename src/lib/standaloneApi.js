export const API_TOKEN_KEY = 'iphone-portfolio:token';

export const API_CACHE_TTL = {
  catalog: 30 * 60 * 1000,
  blog: 10 * 60 * 1000,
  calendarTypes: 30 * 60 * 1000,
  calendarBookings: 60 * 1000,
  homeApps: 10 * 60 * 1000,
};

const apiCacheStore = new Map();
const apiCacheInflight = new Map();

export async function api(path, opts = {}) {
  const { method = 'GET', body, auth = true } = opts;
  const headers = { 'Content-Type': 'application/json' };
  if (auth !== false) {
    const token = localStorage.getItem(API_TOKEN_KEY);
    if (token) headers.Authorization = 'Bearer ' + token;
  }
  const res = await fetch('/api' + path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (_) { /* empty body */ }
  if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
  return data;
}

function apiCacheKey(path, opts = {}, userId = null) {
  const method = (opts.method || 'GET').toUpperCase();
  if (method !== 'GET') return null;
  const scope = opts.auth === false ? 'public' : `user:${userId || 'anon'}`;
  return `${scope}:${path}`;
}

export function invalidateApiCache(prefix) {
  for (const key of [...apiCacheStore.keys()]) {
    if (!prefix || key.startsWith(prefix)) apiCacheStore.delete(key);
  }
}

export async function apiCached(path, opts = {}, ttlMs = API_CACHE_TTL.catalog, userId = null) {
  const key = apiCacheKey(path, opts, userId);
  if (!key) return api(path, opts);

  const now = Date.now();
  const hit = apiCacheStore.get(key);
  if (hit && now - hit.fetchedAt < hit.ttl) return hit.data;

  if (hit) {
    if (!apiCacheInflight.has(key)) {
      apiCacheInflight.set(key, api(path, opts).then((data) => {
        apiCacheStore.set(key, { data, fetchedAt: Date.now(), ttl: ttlMs });
        return data;
      }).finally(() => apiCacheInflight.delete(key)));
    }
    return hit.data;
  }

  if (apiCacheInflight.has(key)) return apiCacheInflight.get(key);

  const req = api(path, opts).then((data) => {
    apiCacheStore.set(key, { data, fetchedAt: Date.now(), ttl: ttlMs });
    return data;
  }).finally(() => apiCacheInflight.delete(key));
  apiCacheInflight.set(key, req);
  return req;
}
