/** Lazy-loaded embedded apps — each import() becomes its own Vite chunk. */
export const appLoaders = {
  calendar: () => import('./chunks/calendar.jsx').then((m) => m.default),
  'app-store': () => import('./chunks/appStore.jsx').then((m) => m.default),
};

const componentCache = new Map();

export async function loadAppComponent(appId) {
  const loader = appLoaders[appId];
  if (!loader) return null;
  if (componentCache.has(appId)) return componentCache.get(appId);
  const Comp = await loader();
  componentCache.set(appId, Comp);
  return Comp;
}
