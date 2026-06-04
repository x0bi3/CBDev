# Mounting modular apps behind Express (reverse proxy pattern)

Heavy client apps (Chat/Odysseus, future CRM, inventory service, etc.) should **not** ship in the Vite home bundle. Instead:

1. Run the service on its own port or host (e.g. Odysseus on `:7000`).
2. Mount a reverse proxy in `server/index.js` under a path prefix (e.g. `/chat`, `/apps/crm`).
3. Add a `home_apps` catalog row with `launch_type = 'route'` and `launch_url = '/chat'`.
4. Grant store eligibility via admin (`user_app_eligibility`), then let users install from the App Store.

The phone shell navigates with `window.location.href` — no iframe, no JS from the proxied app on the home page.

## Reference implementation: Odysseus Chat

| Piece | File |
|-------|------|
| Proxy middleware | `server/lib/odysseusProxy.js` |
| Static asset alias (Cloudflare cache workaround) | `server/lib/odysseusStatic.js` |
| Client path bridge | `server/lib/ody-bridge.js` |
| SSO cookie helper | `server/lib/odysseusAuth.js` |
| Express mount | `server/index.js` — `/chat/*` **before** `express.json()` |

### Checklist for a new proxied app

```javascript
// server/index.js (order matters)
import { createMyAppProxy } from './lib/myAppProxy.js';

// Skip body parsers for proxied paths if the upstream reads raw POST bodies
app.use('/apps/myapp', createMyAppProxy({
  prefix: '/apps/myapp',
  target: process.env.MYAPP_URL || 'http://127.0.0.1:7010',
}));

// Catalog row (SQL or admin UI)
// launch_type: 'route', launch_url: '/apps/myapp', assign_users: true, store_visible: true
```

### Proxy middleware template

Copy `odysseusProxy.js` and adjust:

- **`prefix`** — public URL path (must match `launch_url`).
- **`target`** — upstream origin (`http://127.0.0.1:PORT`).
- **Rewrite rules** — only rewrite `text/html` and `text/css` response bodies. **Do not rewrite JavaScript file bodies** (breaks minified code / regex).
- **Bridge script** (optional) — inject a small shim in HTML `<head>` if the upstream assumes root-relative paths (`/static/`, `/api/`). Serve the shim on your prefix before the proxy.
- **Auth** — if users are already logged into CreativeBuilds, set an SSO cookie or header on proxied requests (see `formatCbdevTokenCookie` in `odysseusAuth.js`).

### Static assets

If a CDN caches corrupted JS from an old path, add a passthrough alias (see `STATIC_PREFIX = '/chat/st'` in `odysseusStatic.js`) and rewrite HTML/CSS references to the alias — not the JS source files themselves.

### Body parser ordering

Global `express.json()` consumes request bodies. Mount proxied routes **before** JSON middleware, or skip parsing for those paths:

```javascript
app.use((req, res, next) => {
  if (req.path.startsWith('/chat/')) return next();
  express.json()(req, res, next);
});
```

### Client catalog

| `launch_type` | Behavior |
|---------------|----------|
| `embedded` | Lazy React chunk inside phone shell |
| `route` | Full navigation to `launch_url` on this site |
| `external` | New tab to external URL |

Store flow: admin sets eligibility → user taps **Get** in App Store → `user_home_apps` row → icon on home screen.
