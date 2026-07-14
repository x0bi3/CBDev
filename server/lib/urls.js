/** Canonical public URLs for CreativeBuilds surfaces (Syrus production). */
export const URLS = {
  studio: process.env.STUDIO_URL || 'https://studio.creativebuilds.dev',
  admin: process.env.ADMIN_URL || 'https://admin.creativebuilds.dev',
  www: process.env.WWW_URL || 'https://www.creativebuilds.dev',
  app: process.env.APP_URL || 'https://app.creativebuilds.dev',
  demo: process.env.DEMO_URL || 'https://demo.creativebuilds.dev',
  apex: process.env.APEX_URL || 'https://creativebuilds.dev',
  contactEmail: process.env.NOTIFY_EMAIL || 'hello@creativebuilds.dev',
};

export const STUDIO_HOSTS = new Set([
  'studio.creativebuilds.dev',
  'localhost',
  '127.0.0.1',
]);

export const ADMIN_HOSTS = new Set([
  'admin.creativebuilds.dev',
  'creativeadmin.cyberopticsoftware.com',
]);

export function hostFromReq(req) {
  return (req.headers.host || '').split(':')[0].toLowerCase();
}

export function isStudioHost(req) {
  const host = hostFromReq(req);
  return STUDIO_HOSTS.has(host);
}

export function isAdminHost(req) {
  return ADMIN_HOSTS.has(hostFromReq(req));
}
