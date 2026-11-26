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

Production (Phase 7) uses default subdomains only: the SPA at `https://noora-studio.pages.dev` and the Worker at `https://noora-api.tridev-g811.workers.dev`. Pages Functions (`frontend/functions/`) proxy `/api/*`, `/images/*`, `/sitemap.xml` and `/robots.txt` to the Worker. `frontend/functions/product/[slug].ts` serves the SPA shell for `/product/:slug` (router path `product/:slug`) with the product's main image preloaded: it fetches `/api/products/:slug` from the Worker (2 s timeout), returns the shell with `Link: <image>; rel=preload; as=image; imagesrcset; imagesizes; fetchpriority=high` and injects the matching `<link rel="preload">` into `<head>` via HTMLRewriter. The response is `Cache-Control: no-cache`. Any upstream failure or 404 returns the plain shell with its original status. This replaces the earlier `_redirects` plan (R17). The browser therefore sees one origin, so `SameSite=Strict` cookies and the no-CORS rule still hold. The Worker sees `https://` URLs, so `Secure` is on. A custom domain is optional and noted in README.md only.

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
5. Check output sizes: `full` ≤ 500 KB, `thumb` ≤ 300 KB (Phase 7 limits; the Worker enforces the same limits on the output).
6. `POST /api/admin/products/<productId>/images` as multipart (`full` and `thumb` parts). The Worker generates the keys, checks type and size (full ≤ 500 KB, thumb ≤ 300 KB), and writes both blobs and the link in one D1 batch. See `.claude/schema.md` Phase 7 additions.
7. Step 6 is the only write. The earlier separate link call (`{ full_r2_key, thumb_r2_key, ... }`) is superseded: blobs and the link are written in one batch.

Module: the image pipeline lives in `frontend/src/components/admin/imagePipeline.ts` (`lib/webp.ts` was not used). Each blob is `image/webp` or `image/jpeg`.

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
/                       Home (HeroBentoBanner, CategoryRail, NewArrivalsGrid, services preview when active services exist)
/products               Catalogue grid with filters, sort, pagination (CatalogView)
/category/:slug         Catalogue filtered by category (CatalogView)
/product/:slug          Product detail (ProductGallery, VariantPicker, QuantityStepper, Add to Bag opens the drawer)
/services               Services grouped by category, "Enquire on WhatsApp"
/cart                   Full-page fallback bag: same checkout as the drawer (useCheckout), "Place Order on WhatsApp"
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

Layout (Phase 8): `StorefrontLayout` wraps the storefront routes in `BagProvider`. It renders `StorefrontHeader` (slender sticky bar: NOORA wordmark, centred nav on desktop, search toggle with debounced search, and a Bag button showing the live item count), `StorefrontFooter`, a fixed mobile `BottomNav` (`md:hidden`; items: `Home` (`/`), `Categories` (`/#categories`), `Services` (`/services`), a Bag button with the live count, and a WhatsApp link when settings have loaded; the slot is kept while they load). The floating `WhatsAppFab` is also rendered, and on phones it is hidden on `/product/*` because the product page has its own buy bar. The header's Bag button and the bottom-nav Bag button both call `openBag()`; they do not navigate to `/cart`. The admin layout is separate and has no storefront chrome.

Route-level code: `/`, `/product/:slug` and the layout are in the entry chunk (`ProductDetailPage` is eager so the gallery LCP image does not wait for a lazy chunk). Other storefront pages are `React.lazy()` chunks. The bag drawer (`CartDrawer`) is a lazy chunk loaded on first open.

## 6a. Cart and bag flow (Phase 8)

- **State:** the cart store stays in `frontend/src/cart/` (`CartContext.tsx`, `reducer.ts`, `lines.ts`), persisted to `localStorage`. Cart edits are client-side only; the server is contacted for product detail (stock and variants) and at order placement.
- **Open paths:** `BagProvider` (`components/storefront/BagProvider.tsx`) owns an `open` flag and exposes `openBag()` through `useBag()`. Three triggers call it: the header Bag button, the bottom-nav Bag button (`BottomNav.tsx`), and the product card's Add to Bag (`ProductGrid.tsx`). The card's quick add fetches `GET /api/products/<slug>`; a single-variant product adds the line (`quickAddVariant`, `lineForVariant` in `bagActions.ts`) and opens the drawer. The product detail page's Add to Bag also calls `openBag()` after adding the selected variant (`ProductDetailPage.tsx`). Quantity caps come from `stockCap.ts`.
- **Drawer:** `CartDrawer` is a right-hand `Sheet` (`components/ui/Sheet.tsx`, modal: focus trap, Escape closes, focus returns to the opener). It is mounted only while open, so `BagProvider` unmounts it on close. It holds the lines (`QuantityStepper`), the customer form and the WhatsApp hand-off, and it links to `/cart` as the full-page fallback.
- **Checkout:** `useCheckout.ts` is the single checkout hook for both the drawer and `/cart`. It validates the form, calls `POST /api/orders` (the server recomputes prices and checks the `order:<ip_hash>` rate limit), then opens the `wa.me` link built by `orderWhatsApp.ts`. The server contract is unchanged from Phase 7.
- **Stock:** `useCartStock.ts` re-reads `GET /api/products/<slug>` for each cart line to refresh stock and variants. Quantities are capped client-side (`stockCap.ts`). The server remains the authority on price and stock at order time.

## 6b. Storefront blocks and primitives (Phase 8)

- `components/ui/` (shared primitives, no product logic): `Button` (`buttonClass`; variants `primary`, `outline`, `ghost`, `light`; sizes `sm`, `md`, `lg`), `Badge` (tones `discount`, `stock`, `soldOut`, `neutral`), `Select`, `Separator`, `Sheet` (slide-over dialog), `cn` (class joiner).
- `components/storefront/` (blocks and page-level pieces): `StorefrontHeader`, `StorefrontFooter`, `BagProvider`, `CartDrawer`, `HeroBentoBanner`, `CategoryRail` (categories from `GET /api/categories`), `NewArrivalsGrid` (`GET /api/products?sort=newest`), `ProductGrid` and `ProductCard` (with `ProductGridSkeleton`), `ProductGallery`, `VariantPicker`, `QuantityStepper`, `PriceLabel`, `ServiceCard`, `CatalogView`, `EditorialPage` and `EditorialSection` (shared by the static pages), `Notice`, `icons.tsx`. Data hooks: `useApiResource`, `useSettings`, `useCartStock`, `useCheckout`. Helpers: `catalogQuery.ts`, `checkout.ts`, `errorMessage.ts`, `orderWhatsApp.ts`, `stockCap.ts`, `bagActions.ts`.
- Pages in `frontend/src/pages/storefront/` compose these blocks. Data access (verified): `HomePage` reads `/api/settings` (`useSettings`, hero headline) and `/api/services`, and composes `HeroBentoBanner`, `CategoryRail` (`/api/categories`) and `NewArrivalsGrid` (`/api/products?sort=newest`); `CatalogView` (products and category pages) reads `/api/products` and `/api/categories`; `ProductDetailPage` reads `/api/products/:slug`; `ServicesPage` reads `/api/services`; `ContactPage` reads `/api/settings`; cart lines are refreshed through `useCartStock`, called from `useCheckout`, which both `CartDrawer` and `/cart` use; `ProductGrid` quick add calls `GET /api/products/:slug`.
- Component tests live in `components/storefront/__tests__/` (`bagActions.test.ts`). No DOM snapshot tests.

Module layout:

```
frontend/src/
  App.tsx                 route table (shell-owned)
  main.tsx
  index.css               design tokens and Tailwind @theme (Phase 8; replaces styles/tokens.css)
  i18n/en.ts              English strings (shell-owned); hi.ts added later
  i18n/index.ts           t(key) helper
  lib/api.ts              typed fetch wrapper for /api/*
  components/ui/          shared primitives: Button, Badge, Select, Separator, Sheet, cn
  components/layout/      StorefrontLayout, BottomNav, WhatsAppFab, useDocumentMeta, seo, focus-trap and hooks
  components/storefront/  Phase 8 storefront blocks, BagProvider, CartDrawer, checkout hooks, helpers
  components/admin/       admin UI, uploader and image pipeline (imagePipeline.ts, uploadImage.ts)
  cart/                   cart store (CartContext, reducer, lines); shared by drawer and /cart
  pages/storefront/       route components for the storefront
  pages/admin/            route components for the admin
```

Note: `lib/webp.ts` and `lib/money.ts` do not exist. The admin image pipeline is `components/admin/imagePipeline.ts`, and money formatting comes from `@beauty-store/shared`.

## 7. Design tokens and i18n

Token file: `frontend/src/index.css` (Phase 8; `styles/tokens.css` was removed). It imports Tailwind v4 with `@import 'tailwindcss'`, and defines two sets of CSS custom properties.

**Admin set (`--bs-*`, on `:root`):** `--bs-accent` `#9d174d`, `--bs-surface` `#fffaf8`, `--bs-ink`, `--bs-muted`, `--bs-border` `#8a7f85`, `--bs-danger`, `--bs-font-sans`, `--bs-radius-card`, `--bs-radius-pill`, `--bs-shadow-card`. The admin keeps this set, so its look did not change in Phase 8.

**Storefront set (`--bg-*`, `--accent-*`, `--ink-*`, `--border-subtle`, `--drawer-*`):** the "Modern Minimal Sage & Cream" palette. Key values: canvas `#fdfbf7`, sand `#f3ede4`, sage `#7a8b7b` (fills and text on sage use `#5e6d5f` hover and `#4d5b4e` pressed, because white on `#7a8b7b` is below 4.5:1), tint `#e4eae3`, ink `#2d312e` and muted ink `#5a605b`, border `#e8e3da`, dark drawer `#1e221f` with surface `#2a2f2b`.

**Tailwind mapping (`@theme`):** the admin tokens map to `--color-accent`, `--color-surface`, `--color-ink`, `--color-muted`, `--color-border`, `--color-danger`, `--font-sans`, `--radius-card`, `--radius-pill`, `--shadow-card`, and the type scale `--text-display`, `--text-heading`, `--text-body`, `--text-small`. The storefront set maps to `--color-canvas`, `--color-sand`, `--color-sage` (plus `-hover`, `-pressed`, `-tint`), `--color-ink-primary`, `--color-ink-muted`, `--color-border-subtle`, `--color-drawer-*`, `--font-display` and `--font-ui`. Utilities such as `bg-sage`, `text-ink-muted`, `border-border-subtle`, `bg-drawer-dark`, `font-display` and `font-ui` come from these. Outside the token definitions in `index.css`, no source file uses raw hex; the `tile-sage` and `tile-sand` utilities (`@utility`, also in `index.css`) are CSS gradients for placeholder tiles, so no image requests are made.

Rule: components use token-backed utility classes, not raw hex. The gradient utilities above are the exception.

Note: `--bs-font-sans` (used by the admin and `body`) names `Inter`. `index.html` does not load Inter, so admin text falls back to the system stack. The storefront root `div` in `StorefrontLayout` uses `font-ui` (Plus Jakarta Sans) and headings use `font-display` (Cormorant Garamond).

**Font loading (Phase 8, `frontend/index.html`):** Cormorant Garamond (weights 500, 600; display) and Plus Jakarta Sans (weights 400 to 700; UI) come from Google Fonts. The file has `preconnect` links to `fonts.googleapis.com` and `fonts.gstatic.com` (crossorigin). The stylesheet is loaded with `media="print"` and switches to `all` in `onload`, so it does not block first paint. A `<noscript>` fallback link is included. The URL uses `display=swap`, so system fallback text shows while the fonts load. Fallback faces (`Cormorant Garamond Fallback`, `Plus Jakarta Sans Fallback`) are metric-tuned in `index.css` to reduce layout shift; tuned on Linux, not yet checked on a real phone. Fonts are not self-hosted; Google Fonts is a third-party dependency.

A global `:focus-visible` outline (3 px, `var(--bs-accent)`, 2 px offset) is in `index.html`'s `<style>` block.

- Components use the `--bs-*` and storefront utilities above. No component uses hard-coded hex (except the `tile-sage`/`tile-sand` gradients).
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

## Phase 8 status (storefront reskin, 2026-11-26)
- Storefront restyled to "Modern Minimal Sage & Cream" with modular blocks (sections 6a, 6b, 7). Admin styling unchanged.
- No change to the request/cache flow, proxy topology, auth/CSRF, D1 schema or `/api/*` contracts. See `.claude/schema.md` Phase 8 note.
- Verified (2026-11-26): bottom-nav items and page data access as described above; initial bundle 118,832 bytes gzip (limit 150,000; `check:bundle` re-run on the baseline `dist`). Phase 8 final deployment: build `index-BTEby1bs`, https://3e75dd7b.noora-studio.pages.dev. Current production baseline: commit `02b280d`, deployment https://c91b5826.noora-studio.pages.dev, build `index-C__s9c-a` (bundle name confirmed live). Deploy from `frontend/` so the Pages Functions bundle is included.
- Product gallery main image: `loading="eager"`, `fetchPriority="high"`, `decoding="async"` (`ProductGallery.tsx`); thumbnails stay `loading="lazy"`. The edge preload's `imagesrcset` and `imagesizes` match these candidates. Live check: the product page returns the `Link` preload header with `fetchpriority=high`.
- Known gap: product page LCP audit 2.84 s median (Phase 7 measured 1.81 s; target < 1.8 s). Perf 91-93 meets the 90 target. The edge preload (`functions/product/[slug].ts`) starts the image earlier but does not move LCP, because the `<img>` renders only after the product API response. Inlining the product JSON into the HTML was considered and rejected (stock and price edits in `/admin` would require HTML cache invalidation). The product LCP target (< 1.8 s) is waived by the user; the clean baseline is commit `02b280d`, deployment `c91b5826` (build `index-C__s9c-a`). Product data stays on the single API path.
- Deviations: no variant swatches on product cards (list API has no variant data); header nav links "Skincare" and "Makeup" now point to `/services` (2026-11-26 nav repoint, commit `02b280d`; previously `/category/skin` and `/category/makeup`, which showed the empty-results notice). The product LCP target is waived by the user; the single product API data path is kept. The services page has no per-category anchors, so no hash is used. Button fill `#5E6D5F` for AA contrast; hero tiles are CSS placeholders.
