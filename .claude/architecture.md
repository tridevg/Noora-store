# Architecture — Beauty Store v1

Living document. Update when a flow, route or boundary changes. Contract details (DDL, endpoints, Zod names) are in `.claude/schema.md`.

## 1. Components

| Component | Path | Runtime | Responsibility |
|---|---|---|---|
| Storefront + admin SPA | `frontend/` | Vite build → Cloudflare Pages (static) | Renders all routes, cart in `localStorage`, client-side WebP pipeline |
| API + image proxy | `backend/` | Hono on Cloudflare Workers (`wrangler dev` locally) | `/api/*`, `/images/*`, auth, cache headers, purge |
| Shared | `shared/` | TypeScript source, no build step | Zod schemas, `formatPaise`, `percentOff`, WhatsApp builders, types |
| Database | D1 binding `DB` | SQLite (local: `backend/.wrangler/state`) | Catalogue, orders, settings, admin, rate limits |
| Image storage | D1 table `product_image_blobs` (no R2 binding) | local D1 state in dev | WebP or JPEG `thumb` and `full` blobs, written in the same batch as the link |

Free-tier rules: no KV, Durable Objects, Queues or Docker. The Worker never resizes or transcodes images.

## 2. Local topology (preview over one SSH tunnel)

```
MacBook browser
  http://localhost:5173        (ssh -L 5173:localhost:5173 ubuntu@<ec2-ip>)
        |
EC2: Vite dev/preview 127.0.0.1:5173
  - serves SPA (HMR in dev)
  - server.proxy and preview.proxy:
      /api/*     -> http://127.0.0.1:8787
      /images/*  -> http://127.0.0.1:8787
        |
EC2: wrangler dev 127.0.0.1:8787   (workerd, local D1 state)
```

Because the browser only ever talks to `localhost:5173`, there is no CORS. The Worker sees `request.url` as `http://127.0.0.1:8787/...`, so the `Secure` cookie flag stays off. That is the intended behaviour for this topology.

Production (Phase 7) uses default subdomains only: the SPA at `https://<project>.pages.dev` and the Worker at `https://beauty-store-api.<subdomain>.workers.dev`. Pages `_redirects` proxies `/api/*` and `/images/*` to the Worker with `200` rewrites (R17). The browser therefore sees one origin, so `SameSite=Strict` cookies and the no-CORS rule still hold. The Worker sees `https://` URLs, so `Secure` is on. A custom domain is optional and noted in README.md only.

## 3. Request and edge-cache flow

Public reads:

```
Browser -> Vite proxy -> Worker GET /api/products?...
  Worker: handler reads D1 (prepared statements, no N+1)
  Worker: sets Cache-Control: public, s-maxage=300, stale-while-revalidate=60
  Cache: workerd/Cloudflare cache honours s-maxage; key = origin + path + query
Browser <- 200 JSON
```

Admin mutation:

```
Admin UI -> PUT/POST/DELETE /api/admin/...  (session cookie + X-CSRF-Token)
  Worker: requireSession -> requireCsrf -> validate (Zod) -> D1 write
  Worker: purgePublicCache(canonicalUrls)   // caches.default.delete(new Request(url))
  Worker: 2xx JSON, Cache-Control: no-store
```

Purge covers the canonical public keys: `/api/categories`, `/api/products`, `/api/services`, `/api/settings`, plus `/api/products/<slug>` for every affected product. Query-string variants expire within 300 s.

Images: `GET /images/<key>` reads the blob row from D1 and returns it with its stored Content-Type and `Cache-Control: public, max-age=31536000, immutable`. Object keys are content-unique (UUID in the name), so immutable caching is safe. Re-uploads get a new key.

Orders: `POST /api/orders` checks the `order:<ip_hash>` rate limit first (5 orders per 15 min per IP hash, else `429` with `Retry-After: 900`), then writes to D1, returns the order ID, and only then does the browser open `https://wa.me/<whatsapp_number>?text=...`. No payment data is collected. The server recomputes every price from D1.

## 4. Client-side image upload pipeline

Runs in `/admin/products/:id` only. Never in the Worker.

1. User picks files. Reject anything that is not an image (`file.type` check).
2. `createImageBitmap(file)` decodes the image.
3. Draw to `OffscreenCanvas` (fallback: `<canvas>`) at two sizes:
   - `full`: long edge at most 1600 px, `toBlob('image/webp', 0.82)`
   - `thumb`: long edge at most 400 px, `toBlob('image/webp', 0.75)`
4. Format check. If `blob.type` is `image/webp`, keep it. If the browser falls back to another type (for example PNG), re-encode that variant with `toBlob('image/jpeg', 0.82)`. Accepted output is only `image/webp` or `image/jpeg`. No browser is rejected.
5. Check output sizes: `full` ≤ 3 MB, `thumb` ≤ 300 KB (approved limits; the Worker enforces the same limits on the output).
6. `POST /api/admin/products/<productId>/images` as multipart (`full` and `thumb` parts). The Worker generates the keys, checks type and size (full ≤ 500 KB, thumb ≤ 300 KB), and writes both blobs and the link in one D1 batch. See `.claude/schema.md` Phase 7 additions.
7. `POST /api/admin/products/:id/images` with `{ full_r2_key, thumb_r2_key, alt_text, sort_order }` links the rows.

Module: `frontend/src/lib/webp.ts` exports `toWebpVariants(file: File): Promise<{ full: Blob; thumb: Blob }>`. Each blob is `image/webp` or `image/jpeg`.

## 5. Admin authentication

Login (`POST /api/admin/login`):

1. Rate limit: `checkRateLimit(db, 'login', ipHash, nowMs)` counts `rate_limits` rows with `key = 'login:' || SHA-256(client IP)` in the last 15 min. At 5 or more failures, return `429` with `Retry-After: 900`.
2. Look up `admin_users` by username. Verify the password with PBKDF2 (Web Crypto, SHA-256, 100,000 iterations, which is the Workers ceiling). Compare derived bytes in constant time.
3. On failure, `recordRateLimitHit(db, 'login', ...)` inserts a row and the response is `401`. Do not reveal whether the username exists.
4. On success, `clearRateLimit(db, 'login', ...)` deletes that IP's `login:` rows, then issue:
   - `bs_admin` = `base64url(JSON {sub, exp})` + `.` + `base64url(HMAC-SHA256(SESSION_SECRET, payload))`, `HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`
   - `bs_csrf` = 32 random bytes in hex, `SameSite=Strict; Path=/` (no HttpOnly)
5. Both cookies get `Secure` only when `request.url.startsWith('https://')`.

Session check (each admin request): parse `bs_admin`, verify the HMAC with a constant-time compare, check `exp`. Failure gives `401`.

CSRF (each admin mutation): `X-CSRF-Token` header must equal the `bs_csrf` cookie value. Mismatch or missing gives `403 csrf_failed`. Login and logout are the only exceptions (logout still requires CSRF).

Secret handling: `SESSION_SECRET` in `backend/.dev.vars` locally and as a Wrangler secret in production. `ADMIN_PASSWORD_HASH` in `.dev.vars` is read only by the admin provisioning step, which writes it into `admin_users`. The D1 row is the login source of truth.

Modules:

- `backend/src/auth/pbkdf2.ts`: `hashPassword`, `verifyPassword`
- `backend/src/auth/session.ts`: `signSession`, `verifySession`
- `backend/src/auth/cookies.ts`: `buildAuthCookies(request, sessionToken, csrfToken)`, `clearAuthCookies(request)`
- `backend/src/http/rateLimit.ts`: `hashIp`, `checkRateLimit`, `recordRateLimitHit`, `clearRateLimit` (shared by login and orders; plan Task 3.6)
- `backend/src/admin/middleware.ts`: `requireSession`, `requireCsrf`

## 6. Frontend route tree

Routes are declared in `frontend/src/App.tsx` with `createBrowserRouter`. Every page is `React.lazy()` loaded, so each route is its own chunk. Only the layout and the home route stay in the initial bundle.

```
/                       Home (hero, category tiles, featured products, services preview, WhatsApp FAB)
/products               Catalogue grid with filters, sort, pagination
/category/:slug         Catalogue filtered by category
/product/:slug          Product detail (gallery with zoom, size and colour selectors, Add to Cart)
/services               Services grouped by category, "Enquire on WhatsApp"
/cart                   Cart, customer form (Zod), "Place Order on WhatsApp"
/about                  Static
/contact                Static (map link, phone, WhatsApp)
/shipping-returns       Static
/privacy-policy         Static
/admin/login            Admin login
/admin                  Admin shell, requires session (loader calls GET /api/admin/session, else redirect to /admin/login)
/admin/products         Products list
/admin/products/:id     Product editor (variants, WebP uploads)
/admin/services         Services CRUD
/admin/orders           Orders status manager
/admin/settings         Settings editor
*                       Not found
```

Layout: `storefront` layout has the sticky header with debounced search, and a fixed mobile bottom nav (`Home`, `Categories`, `Services`, `Cart`, `WhatsApp`). The admin layout is separate and has no storefront chrome.

Module layout:

```
frontend/src/
  App.tsx                 route table (shell-owned)
  main.tsx
  styles/tokens.css       design tokens (shell-owned)
  i18n/en.ts              English strings (shell-owned); hi.ts added later
  i18n/index.ts           t(key) helper
  lib/api.ts              typed fetch wrapper for /api/*
  lib/money.ts            re-export of shared formatPaise
  lib/webp.ts             WebP pipeline (admin track)
  components/ui/          shared primitives (shell-owned)
  components/layout/      storefront header, bottom nav, WhatsApp FAB (storefront track)
  cart/                   cart store and Cart page logic (storefront track)
  storefront/             page components (storefront track)
  admin/                  admin pages and components (admin track)
```

## 7. Design tokens and i18n

- `frontend/src/styles/tokens.css` defines CSS custom properties on `:root`: colour (accent plus neutrals), type scale, spacing, radius (rounded product cards), shadow. Tailwind v4 reads them through `@theme`. Components use token-backed utility classes only, with no raw hex values.
- Text lives in `frontend/src/i18n/en.ts`. The file exports a const object and `type Messages = typeof en`. `i18n/index.ts` exposes `t(key: keyof Messages)`. Components never hold English strings directly.
- Adding Hindi means adding `hi.ts` with the same shape. No component changes.

## 8. Shared package boundaries

`shared/src/index.ts` is the only export surface.

- `money.ts`: `formatPaise`, `percentOff`, `sumPaise`
- `whatsapp.ts`: `buildWhatsAppUrl`, `buildOrderMessage`, `buildEnquiryMessage`
- `schemas/*.ts`: Zod request schemas (names in `schema.md`)
- `types.ts`: DTO types inferred from the schemas and response shapes

Backend and frontend import `@beauty-store/shared` as TypeScript source through npm workspaces. There is no build step for shared.

## 9. Test layers

- Shared: Vitest unit tests (paise, percent, WhatsApp builder, schemas).
- Frontend: Vitest unit tests (cart reducer, storefront helpers). No DOM snapshot tests in v1.
- Backend: Vitest with `@cloudflare/vitest-pool-workers` (Miniflare-backed). Migrations are applied in setup. Tests cover public endpoints and cache headers, order total recomputation, auth, CSRF, rate limiting, CRUD, and purge.
- Verification: `tsc --noEmit` per workspace, bundle-size script, headless Lighthouse (Phase 6).


## Phase 5 status (frontend built)
- Initial JS gzip: 134,547 bytes (limit 150,000). Every route is React.lazy; only StorefrontLayout and CartProvider are eager.
- Storefront: /, /products, /category/:slug, /product/:slug, /services, /cart. Admin: /admin/login and the dashboard, products, products/:id, services, orders, and settings routes.
- Known gaps: About, Contact, Shipping, Privacy and NotFound are still placeholders (Phase 6). Stock is not enforced at add-to-cart or checkout. There are no image reorder or alt-text endpoints. Categories and settings in the admin are read from the public GET endpoints.
