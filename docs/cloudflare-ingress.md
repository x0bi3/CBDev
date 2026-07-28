# Cloudflare Tunnel Ingress — Syrus

**Primary site:** `www.creativebuilds.dev` (marketing static, port 3001)  
**Secondary:** `studio.creativebuilds.dev` (Creative Studio iOS shell, port 3020)  
**API:** `www.creativebuilds.dev/api/*` → cbdev Express (port 3021)

| Hostname | Backend | Status |
|----------|---------|--------|
| `www.creativebuilds.dev` | `http://localhost:3001` | **Primary — live** |
| `www.creativebuilds.dev/api/*` | `http://localhost:3021` | Via ingress routing |
| `creativebuilds.dev` | 301 → `https://www.creativebuilds.dev` | Apex redirect |
| `studio.creativebuilds.dev` | tunnel → `:3020` ingress → `:3021` cbdev | iOS Creative Studio shell (needs DNS CNAME to tunnel) |
| `admin.creativebuilds.dev` | tunnel → `:3020` ingress → `:3021` cbdev | Admin CMS |
| `app.creativebuilds.dev` | `http://localhost:3004` | Client dashboard (`@cbdev/dashboard` PM2) |
| `demo.creativebuilds.dev` | `http://localhost:3003` | When demo deployed |
| `media.creativebuilds.dev` | `http://localhost:8096` | Jellyfin + Cloudflare Access |

## Apex redirect

Cloudflare Dashboard → Rules → Redirect Rules:

- `creativebuilds.dev/*` → `https://www.creativebuilds.dev/$1` (301)

Studio stays at `studio.creativebuilds.dev` only — not on apex.

## Studio subdomain

```bash
cloudflared tunnel route dns <tunnel-name> studio.creativebuilds.dev
```

Add to `config.yml` ingress (before catch-all):

```yaml
  - hostname: studio.creativebuilds.dev
    service: http://localhost:3020
```

## Rollback

Revert ingress rule. Apex should redirect to www, not studio.
