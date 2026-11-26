# Beauty Store v1 — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-11-26-beauty-store-v1-design.md`
**Contracts (locked):** `.claude/schema.md` (DDL, endpoints, Zod names, cookies, purge rule)
**Architecture:** `.claude/architecture.md` (flows, proxy topology, auth, route tree, upload pipeline)
**State:** `.claude/manifest.json`, `.claude/scratchpad.md` (orchestrator-owned; each phase syncs them before its gate)

No app code exists yet. Phase 1 starts only after Node 22 is installed and the user approves this plan. This file is a checklist: behaviour and contracts live in the docs above.

> **Close-out status (2026-11-26):** Phases 0–5 verified and committed. Phase 6 committed as partial (home Lighthouse below target), then the home page passed on the live site in Phase 7. Phase 7 deployed and signed off. Live: https://noora-studio.pages.dev (storefront), https://noora-api.tridev-g811.workers.dev (API). The checklist below is the original plan. Where it conflicts with what shipped, these decisions win:
> - Images stored in D1 blobs, not R2 (card-free). Full cap 500 KB (R8 lowered from 3 MB); thumb 300 KB.
> - Pages Functions (`frontend/functions/`) proxy `/api`, `/images`, `/sitemap.xml`, `/robots.txt`; `_redirects` is SPA fallback only (R17 superseded).
> - Admin upload is one multipart POST to `/api/admin/products/:id/images` (supersedes the `PUT /api/admin/uploads` step in 4.5).
> - Worker `noora-api`, Pages `noora-studio`; deploys use `wrangler login --device --browser=false`, not `CLOUDFLARE_API_TOKEN`.
> - Admin origin check added (403 on a foreign `Origin`).
> - Route list and contracts: `endpoints.txt` and `.claude/schema.md`.

---

## Phase 8 close-out (2026-11-26): storefront reskin

Frontend only; no schema, migration, `/api/*` or backend change. User approved; deployed to https://noora-studio.pages.dev (final deployment https://3e75dd7b.noora-studio.pages.dev, build `index-BTEby1bs`). Shipped design:

- **Tokens:** "Modern Minimal Sage & Cream" in `frontend/src/index.css` (replaces `styles/tokens.css`). Admin `--bs-*` set unchanged. Sage accent with `#5E6D5F` fill for buttons (white on `#7A8B7B` fails AA).
- **Blocks:** slender sticky header, `HeroBentoBanner` (CSS gradient placeholder tiles, no image assets), `CategoryRail`, `NewArrivalsGrid`, product grid and card, footer, fixed mobile bottom nav with live Bag count.
- **Bag drawer:** right-hand sheet (`CartDrawer` on `ui/Sheet`) opened from the header, bottom nav and Add to Bag. Checkout shared with `/cart` via `useCheckout`; server still recomputes prices and enforces `order:<ip_hash>`.
- **Fonts:** Cormorant Garamond (display) and Plus Jakarta Sans (UI) from Google Fonts with `display=swap`, non-blocking stylesheet load, metric-tuned fallbacks. Not self-hosted.
- **Product page:** `ProductDetailPage` in the entry chunk; skeleton sizing and a stable bottom-nav slot to limit CLS.

Deviations from the original checklist:
- No variant swatches on product cards: the list API carries no variant data. Quick add fetches the product detail.
- Nav link `/category/skincare` has no matching category; closest real slug is `skin`. Unresolved.
- Hero tiles are CSS placeholders (approved), not photography.

Verification: typecheck, lint, format:check, `npm test` 27/120/47, build, bundle 118,836 bytes gzip (limit 150,000). Lighthouse mobile: home Perf 94-98, A11y 100, SEO 100; product Perf 91-92, A11y 100, SEO 100. Product LCP audit 2.8 s (Phase 7 measured 1.81 s): open item, next lever is a product API preload.

Deploy: run from `frontend/` with `--branch=main` so the Pages Functions bundle is included and the deploy goes to production (see CLAUDE.md).

---

Hard limits (paise, 10 ms Worker CPU, 150,000-byte bundle, Lighthouse ≥ 90) live in `CLAUDE.md` and architecture.md; this plan does not repeat them.

## Resolutions

Architect decisions. Each is referenced by the task that implements it. R7, R8, R12, R13 and R15 were approved by the user.

| ID | Topic | Decision |
|---|---|---|
| R3 | "150 KB gzipped" | 150,000 bytes. `check-bundle` fails at 150,000 or more. |
| R4 | PBKDF2 | 100,000 iterations (Workers Web Crypto ceiling). |
| R5 | Admin hash source | `admin_users.password_hash` in D1 is the login source of truth. `ADMIN_PASSWORD_HASH` (`.dev.vars` or secret) is read only by provisioning. `SESSION_SECRET` is the HMAC key. |
| R6 | Purge vs query variants | Purge canonical keys only (no query). Filtered and paginated variants expire by `s-maxage=300`. |
| R7 | Login limit | 5 failed attempts per IP hash per 15 min, then `429` with `Retry-After: 900`. Approved. |
| R8 | Image limits | Output size: `full` ≤ 3 MB, `thumb` ≤ 300 KB. Enforced in browser and Worker. Approved. |
| R9 | Category CRUD | Out of v1 admin. Categories are seeded only. |
| R10 | Production domains | Default subdomains only: SPA on `*.pages.dev`, API on `*.workers.dev`, images via the Worker `/images/*` route. No custom domain required. Optional custom-domain binding goes in README.md only. |
| R12 | Chrome for Lighthouse | Ubuntu system Chromium is not used. Install with `npx @puppeteer/browsers install chrome@stable`, set `CHROME_PATH`. Approved. |
| R13 | WebP fallback | Do not reject browsers. Request WebP. If the output is not `image/webp`, re-encode JPEG at quality 0.82. Accept only `image/webp` or `image/jpeg`; the upload key extension (`.webp`/`.jpg`) and the stored Content-Type must match. Approved. |
| R14 | Remote seed | Phase 7 seeds categories, settings and the admin row only. |
| R15 | Node | Node 22 LTS. CLAUDE.md updated to match. Approved. |
| R16 | Rate limits | One D1 table `rate_limits(key TEXT, attempted_at INTEGER)`, keys `login:<ip_hash>` (5 failed logins/15 min) and `order:<ip_hash>` (5 orders/15 min). Prune rows older than 24 h on each insert. **Deliberate deviation:** renames the spec's `login_attempts`; approved by user. |
| R17 | Production same-origin | Pages `_redirects` proxies `/api/*` and `/images/*` to the Worker (200 rewrites), so the browser sees one origin and `SameSite=Strict` cookies work with no CORS. Architect decision; user to confirm. |

Owners: Phase 0 orchestrator + user; 1–4 backend-builder; 5 frontend-builder; 6 verifier; 7 verifier after approval. Each phase lists its exclusive paths and gate. One agent writes a path at a time; 5b and 5c own disjoint paths.

---

## Phase 0 — Env bootstrap

- [ ] **0.1 Install Node 22 LTS (BLOCKED, user action).** Verify: `node --version` → `v22.*`; `npm --version` → 10.x or later.
- [ ] **0.2 Approve plan and Resolutions.** Files: this plan, `.claude/architecture.md`, `.claude/schema.md`, `CLAUDE.md`. Then `manifest.json` Phase 0 → done.

---

## Phase 1 — Monorepo scaffold

**Owner:** backend-builder. **Paths:** root `package.json`, `package-lock.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`, `.gitignore`, `README.md`; stub `package.json`/`tsconfig.json`/`src/index.ts` in `shared/`, `backend/`, `frontend/`.

- [ ] **1.1 Root workspace.** `"private": true`; workspaces `["shared","backend","frontend"]`; scripts `typecheck`, `test`, `lint`, `build` fan out with `--workspaces --if-present`. `.gitignore`: `node_modules/`, `dist/`, `.wrangler/`, `.dev.vars`, `*.local`.
- [ ] **1.2 TypeScript and lint.** `tsconfig.base.json`: strict, `noUncheckedIndexedAccess`, `moduleResolution: bundler`, ES2022/ESNext. Backend adds `@cloudflare/workers-types`; frontend adds DOM. ESLint flat config with typescript-eslint recommended; Prettier. Pin versions compatible with `@cloudflare/vitest-pool-workers`.
- [ ] **1.3 Stubs and test runner.** Names: `@beauty-store/shared` (`main: src/index.ts`), `@beauty-store/backend`, `@beauty-store/frontend`. Vitest per workspace; `passWithNoTests`.
- [ ] **1.4 README.md.** Prerequisites (Node 22), install, dev (`wrangler dev` on 127.0.0.1:8787, `npm run dev -w frontend` on 127.0.0.1:5173), tests, SSH tunnel preview, deploy pointer, optional custom-domain note (R10).

**Gate:** `npm install && npm run typecheck --workspaces --if-present && npm run lint && echo PHASE1_OK`

---

## Phase 2 — Shared package

**Owner:** backend-builder. **Paths:** `shared/**` only. **Consumed by:** Phases 3–5.

- [ ] **2.1 Money (TDD)** — `shared/src/money.ts`, `shared/test/money.test.ts`
  ```ts
  formatPaise(paise: number): string;                              // throws RangeError if non-integer or negative
  percentOff(mrpPaise: number, pricePaise: number): number;        // integer 0..100, half-up; 0 when mrp is 0
  sumPaise(values: readonly number[]): number;
  ```
  Tests: `129900`→`₹1,299`; `129950`→`₹1,299.50`; `0`→`₹0`; `1.5` and `-1` throw; `percentOff(10000,7500)===25`.
- [ ] **2.2 WhatsApp builders (TDD)** — `shared/src/whatsapp.ts`, `shared/test/whatsapp.test.ts`
  ```ts
  buildWhatsAppUrl(number: string, text: string): string;   // https://wa.me/<digits>?text=<encoded>; throws under 8 digits
  buildOrderMessage(input: { orderId; items; totalPaise; address; customerName; customerPhone }): string;
  // includes "Order ID", each line item, total, address, and "Cash / UPI on Delivery"
  buildEnquiryMessage(input: { serviceName: string; businessName: string }): string;
  ```
- [ ] **2.3 Zod schemas (TDD)** — `shared/src/schemas/{common,catalogue,orders,admin,uploads}.ts`, `shared/test/schemas.test.ts`. Names are the contract (schema.md): `PaiseSchema`, `SlugSchema`, `ProductListQuerySchema` (`per_page` max 48), `ProductCreateSchema`, `ProductUpdateSchema`, `VariantCreateSchema`, `VariantUpdateSchema`, `ImageCreateSchema`, `UploadKeySchema`, `ServiceCreateSchema`, `ServiceUpdateSchema`, `CartItemSchema` (qty 1..20), `CreateOrderSchema`, `OrderStatusUpdateSchema`, `OrderListQuerySchema`, `AdminProductListQuerySchema`, `SettingsUpdateSchema`, `LoginSchema`.
  - `UploadKeySchema`: `^products/\d+/[0-9a-f-]{36}-(full|thumb)\.(webp|jpg)$` (R13).
  - `CreateOrderSchema` is strict: rejects `price_paise`, `total_paise`, `unit_price_paise`.
  - Tests: rejects `total_paise` in order; `PaiseSchema` rejects `12.5`; upload key rejects `../x.webp` and `products/1/x-full.png`; `SlugSchema` rejects `Bad Slug`; `per_page=49` rejected.
- [ ] **2.4 Types and exports** — `shared/src/types.ts` (`CategoryDto`, `ProductSummaryDto`, `ProductDetailDto`, `VariantDto`, `ImageDto`, `ServiceDto`, `OrderDto`, `AdminProductDto`, `SettingsMap`, `DashboardDto`, `ErrorEnvelope`); `shared/src/index.ts` is the only export surface.

**Gate:** `npm run test -w shared && npm run typecheck -w shared && echo PHASE2_OK`

---

## Phase 3 — Backend public API, migration, rate limiter, seed

**Owner:** backend-builder. **Paths:** `backend/migrations/**`, `backend/wrangler.toml`, `backend/scripts/seed.ts`, `backend/seed/seed.sql` (generated), `backend/src/{index.ts,env.ts,routes/{public,orders,images}.ts,http/**}`, `backend/test/{public,orders,images,migrations,rateLimit}.test.ts`, `backend/vitest.config.ts`.

- [ ] **3.1 Migration 0001 (TDD)** — `backend/migrations/0001_init.sql` = DDL in schema.md (10 tables, including `rate_limits`, with indexes). `migrations.test.ts` asserts every table and index via `sqlite_master`.
  Verify: `npm run test -w backend -- migrations`.
- [ ] **3.2 Wrangler and Env** — `wrangler.toml`: `name = "beauty-store-api"`, `main = "src/index.ts"`, D1 binding `DB` (`beauty-store`, `migrations_dir = "migrations"`), R2 binding `IMAGES` (`beauty-store-images`).
  ```ts
  // backend/src/env.ts
  export type Env = { DB: D1Database; IMAGES: R2Bucket; SESSION_SECRET: string };
  ```
- [ ] **3.3 Deterministic seed** — `backend/scripts/seed.ts`. CLI: `npx tsx backend/scripts/seed.ts --mode=local|remote`. PRNG mulberry32, seed 42. Local: 50–150 products (target 100), 20–30 services (target 25), ≥5 categories, 5 settings rows, one admin row, prices in multiples of 100 paise with MRP ≥ price, placeholder objects in local R2 (`wrangler r2 object put --local`). Remote: categories, settings, admin row only (R14). Admin hash from `ADMIN_PASSWORD_HASH` (R5).
  Verify: `npx wrangler d1 execute beauty-store --local --config backend/wrangler.toml --command "SELECT (SELECT count(*) FROM products) p, (SELECT count(*) FROM services) s"` → p 50–150, s 20–30.
- [ ] **3.4 Hono app, errors, cache headers** — `backend/src/index.ts`; `http/errors.ts` (`apiError(c, status, code, message, fields?)`; `onError` and `notFound` emit the error envelope, so unknown route gives `404 not_found`); `http/cache.ts`:
  ```ts
  export const CACHE_PUBLIC = "public, s-maxage=300, stale-while-revalidate=60";
  export const CACHE_IMMUTABLE = "public, max-age=31536000, immutable";
  export const CACHE_NO_STORE = "no-store";
  ```
- [ ] **3.5 Public reads (TDD)** — `routes/public.ts`, `test/public.test.ts`. Endpoints per schema.md: `GET /api/categories`, `/api/products` (filters, sort, pagination), `/api/products/:slug`, `/api/services`, `/api/settings`. Only `is_active = 1` rows; prepared statements; `CACHE_PUBLIC` on all five. Tests: shapes; inactive absent; exact cache string; `per_page=49` → `400 validation_failed`; prices are integers.
- [ ] **3.6 Rate limiter and order creation (TDD)** — `backend/src/http/rateLimit.ts`, `routes/orders.ts`, `test/rateLimit.test.ts`, `test/orders.test.ts`.
  ```ts
  type RateBucket = "login" | "order";     // 5 per 15 min per IP hash (R16)
  hashIp(ip: string): Promise<string>;      // hex SHA-256; IP from CF-Connecting-IP, fallback 127.0.0.1
  checkRateLimit(db: D1Database, bucket: RateBucket, ipHash: string, nowMs: number): Promise<{ allowed: boolean; retryAfterSec: number }>; // retryAfterSec 900 when blocked
  recordRateLimitHit(db, bucket, ipHash, nowMs): Promise<void>;   // INSERT key=`${bucket}:${ipHash}`; then prune attempted_at < nowMs - 24h
  clearRateLimit(db, bucket, ipHash): Promise<void>;
  createOrder(db: D1Database, input: z.infer<typeof CreateOrderSchema>): Promise<OrderDto>;
  ```
  - `POST /api/orders`: run `checkRateLimit('order')` first (`429 rate_limited`, `Retry-After: 900`). Unit prices from `product_variants JOIN products`; `total = sumPaise(unit × qty)`. Unknown variant, inactive product or qty above stock → `409 conflict`. No stock decrement (v1). On `201`, `recordRateLimitHit('order')`. Response `201 { id, status: "new", total_paise, items_count }`, `NO_STORE`.
  - Tests: 5 orders pass, 6th → 429; tampered `total_paise` → 400; inactive → 409; total equals D1 prices × qty; limiter window and 24 h pruning.
- [ ] **3.7 Image proxy (TDD)** — `routes/images.ts`, `test/images.test.ts`. `GET /images/*` streams `env.IMAGES.get(key)` without buffering; `CACHE_IMMUTABLE`; `Content-Type` from `httpMetadata`; `404 not_found` if missing; `400` if key contains `..`.
- [ ] **3.8 Vitest pool** — `backend/vitest.config.ts` with `@cloudflare/vitest-pool-workers`, `wrangler.toml` as config; setup applies migrations via `readD1Migrations`.

**Gate:** `npm run test -w backend && npm run typecheck -w backend && echo PHASE3_OK`

---

## Phase 4 — Backend admin API

**Owner:** backend-builder. **Paths:** `backend/src/{auth/**,admin/**,cache/**}`, `backend/scripts/hash-password.ts`, `backend/test/admin/**`, one `app.route('/api/admin', adminRoutes)` line in `backend/src/index.ts`.

- [ ] **4.1 PBKDF2 (TDD)** — `auth/pbkdf2.ts`. `PBKDF2_ITERATIONS = 100_000` (R4). `hashPassword(pw)` → `pbkdf2-sha256$100000$<saltB64>$<hashB64>` (16 B salt, 32 B key, `crypto.subtle`). `verifyPassword(pw, stored)`: constant-time; returns `false` on malformed input, never throws. CLI `scripts/hash-password.ts` reads stdin.
  Verify: `echo -n 'test-pass' | npx tsx backend/scripts/hash-password.ts | cut -d'$' -f1-2` → `pbkdf2-sha256$100000`.
- [ ] **4.2 Session and cookies (TDD)** — `auth/session.ts`, `auth/cookies.ts`.
  ```ts
  signSession(payload: { sub: string; exp: number }, secret: string): Promise<string>;
  verifySession(token: string, secret: string, nowSec: number): Promise<{ sub: string; exp: number } | null>;
  buildAuthCookies(request: Request, sessionToken: string, csrfToken: string): string[];
  clearAuthCookies(request: Request): string[];
  ```
  `bs_admin`: HttpOnly, SameSite=Strict, Max-Age 28800. `bs_csrf`: no HttpOnly. `Secure` only when `request.url.startsWith('https://')`. Tests cover both URL schemes, tampered and expired tokens.
- [ ] **4.3 Login wiring (TDD)** — `admin/auth.routes.ts`. Uses the Phase 3 limiter (no new limiter code). Order: `checkRateLimit('login')` → `429` with `Retry-After: 900`; wrong user or password → `recordRateLimitHit('login')`, `401 unauthorized` (identical for both); success → `clearRateLimit('login')`, set both cookies. Tests: 5 failures then 6th → 429; success clears.
- [ ] **4.4 Routes and middleware (TDD)** — `admin/middleware.ts`, `admin/auth.routes.ts` (login, logout, session).
  ```ts
  requireSession: MiddlewareHandler<{ Bindings: Env; Variables: { admin: { sub: string } } }>;
  requireCsrf: MiddlewareHandler<...>;   // X-CSRF-Token must equal bs_csrf cookie, else 403 csrf_failed
  ```
  Every non-GET route in `adminRoutes` except login gets `requireSession` then `requireCsrf` (logout included). Every admin response is `no-store`. Tests: enumerate all non-GET admin routes; each returns 403 without the header; `GET /api/admin/session` without cookie → 401.
- [ ] **4.5 Admin CRUD (TDD)** — `admin/{products,variants,services,orders,settings,dashboard}.routes.ts`, `admin/index.ts` (exports `adminRoutes: Hono<{ Bindings: Env; Variables: { admin: { sub: string } } }>`). Endpoint list and shapes: schema.md "Admin endpoints". Rules: duplicate slug, sku or size+colour → `409`; unknown id → `404`; illegal order transition → `409`; product delete removes R2 objects (list rows, `IMAGES.delete`), then the row (FK cascade); `PaiseSchema` rejects floats; unknown settings key → `400`.
- [ ] **4.6 Uploads (TDD)** — `admin/uploads.routes.ts`.
  - `PUT /api/admin/uploads?key=` (raw body). Key via `UploadKeySchema`. `Content-Type` must be `image/webp` or `image/jpeg` and match the key extension (`.webp`/`.jpg`). Size limits on output: `full` ≤ 3 MB, `thumb` ≤ 300 KB (R8), checked from `Content-Length` and the streamed size; violation → `413 validation_failed`. Store with `IMAGES.put(key, body, { httpMetadata: { contentType: <actual> } })`. Never decode or re-encode in the Worker.
  - `POST /api/admin/products/:id/images`: `IMAGES.head` both keys first; missing → `409`.
  - `DELETE /api/admin/products/:id/images/:imageId`.
  - Tests: `..` → 400; `image/png` → 400; oversize → 413; `.jpg` key with `image/webp` → 400; valid JPEG → 201 and `GET /images/<key>` serves `image/jpeg`.
- [ ] **4.7 Cache purge (TDD)** — `cache/purge.ts`.
  ```ts
  publicCacheUrls(origin: string, productSlugs: readonly string[]): string[];   // canonical keys only (R6)
  purgePublicCache(origin: string, productSlugs: readonly string[]): Promise<void>; // caches.default.delete per URL; resolves even if a delete returns false
  ```
  Each mutation marked "yes" in schema.md calls it after the D1 write succeeds (not before, not on failure). Product update passes old and new slugs.

**Gate:** `npm run test -w backend && npm run typecheck -w backend && echo PHASE4_OK`. Also `grep -rn "api/admin" backend/src | wc -l` ≥ 20.

---

## Phase 5 — Frontend

**Owner:** frontend-builder. Route tree and module layout: architecture.md §6.

- [ ] **5a Shell (sequential, first)** — **Paths:** `frontend/{package.json,vite.config.ts,tsconfig.json,index.html,public/_redirects}`, `frontend/src/{main.tsx,App.tsx,styles/**,i18n/**,lib/api.ts,components/ui/**}`.
  - `vite.config.ts`: `server` and `preview` on 127.0.0.1 ports 5173 and 4173, `strictPort`; proxy `/api` and `/images` to `http://127.0.0.1:8787`.
  - `public/_redirects` (local): `/* /index.html 200`. Phase 7 prepends proxy rules (R17).
  - `App.tsx`: `createBrowserRouter`; every page `React.lazy`.
  - `lib/api.ts`: `apiGet<T>(path, signal?)`, `apiPost<T>(path, body, opts?: { csrf?: boolean })`; `apiPut`, `apiPatch`, `apiDelete` analogous. `csrf: true` reads `bs_csrf` and sends `X-CSRF-Token`.
  - `i18n/en.ts`: `export const en = {...} as const; export type Messages = typeof en;`.
  - Verify: `npm run build -w frontend` exits 0; `npm run test -w frontend -- App` (Home renders).
- [ ] **5b Storefront (parallel with 5c)** — **Paths:** `frontend/src/{storefront/**,cart/**,components/layout/**}`.
  ```ts
  type CartLine = { productId: number; variantId: number; slug: string; name: string; size: string; colour: string; unitPricePaise: number; qty: number };
  addLine(lines, line): CartLine[];                 // merges same variantId; qty capped at 20
  setQty(lines, variantId, qty): CartLine[];        // qty 0 removes
  removeLine(lines, variantId): CartLine[];
  subtotalPaise(lines): number;                     // sumPaise
  CART_STORAGE_KEY = "bs_cart_v1";
  loadCart(storage: Storage): CartLine[];           // corrupt JSON → []
  saveCart(storage: Storage, lines: CartLine[]): void;
  ```
  Rules: header search debounced 300 ms; checkout validates with `CreateOrderSchema`, posts `/api/orders`, shows a clear message on `429`, then opens `buildWhatsAppUrl(buildOrderMessage(...))`. Prices via `formatPaise`; discounts via `percentOff`. All strings from `en.ts`.
  Verify: `npm run test -w frontend -- cart`; `npm run typecheck -w frontend`.
- [ ] **5c Admin (parallel with 5b)** — **Paths:** `frontend/src/{admin/**,lib/webp.ts}`, `frontend/test/webp.test.ts`.
  ```ts
  FULL_MAX_EDGE = 1600; FULL_QUALITY = 0.82;
  THUMB_MAX_EDGE = 400; THUMB_QUALITY = 0.75;
  toWebpVariants(file: File): Promise<{ full: Blob; thumb: Blob }>;
  // non-image → AdminError("not_image")
  // blob.type not image/webp → re-encode image/jpeg at 0.82 (R13); other types → AdminError("unsupported_output")
  // output over 3 MB (full) or 300 KB (thumb) → AdminError("output_too_large") (R8)
  ```
  Tests (mocked `toBlob`): PNG fallback yields JPEG at 0.82; non-image throws; oversize throws. Pages: login, dashboard, products list, product editor (variants, multi-upload with progress), services CRUD, orders (only legal transitions offered), settings. Every mutation uses `csrf: true`. `/admin` route guard calls `GET /api/admin/session`.
  Verify: `npm run test -w frontend -- webp`; `npm run typecheck -w frontend`.

**Gate:** `npm run typecheck -w frontend && npm run test -w frontend && npm run build -w frontend && echo PHASE5_OK`

---

## Phase 6 — Verification

**Owner:** verifier, against the local stack. Failures return to the owning phase; do not patch here.
**Paths:** `frontend/scripts/check-bundle.mjs` (results recorded in `.claude/manifest.json`).

- [ ] **6.1 Static and unit:** `npm run typecheck --workspaces --if-present` and `npm run test --workspaces --if-present` exit 0.
- [ ] **6.2 Bundle gate (TDD):** script reads `frontend/dist/index.html`, collects `<script type="module" src>` and `<link rel="modulepreload" href>`, gzips each (level 9), sums, prints `initial JS gzip: <N> bytes (limit 150000)`; exits 1 if `N >= 150000` (R3). Test against a fixture first.
  Verify: `npm run build -w frontend && node frontend/scripts/check-bundle.mjs`.
- [ ] **6.3 Local stack:**
  ```bash
  # terminal A: backend
  npx wrangler d1 migrations apply beauty-store --local --config backend/wrangler.toml
  npx tsx backend/scripts/seed.ts --mode=local
  npx wrangler d1 execute beauty-store --local --config backend/wrangler.toml --file backend/seed/seed.sql
  npx wrangler dev --config backend/wrangler.toml --ip 127.0.0.1 --port 8787
  # terminal B: frontend
  npm run build -w frontend && npm run preview -w frontend
  curl -sI http://127.0.0.1:4173/api/products | grep -i '^cache-control'   # public, s-maxage=300, stale-while-revalidate=60
  curl -s http://127.0.0.1:4173/api/products | jq '.items | length'        # ≥ 1
  ```
- [ ] **6.4 Lighthouse (Home and Product).** Chrome per R12: `npx @puppeteer/browsers install chrome@stable`, export `CHROME_PATH`. Output to a scratch directory outside the repo.
  ```bash
  SLUG=$(curl -s http://127.0.0.1:4173/api/products | jq -r '.items[0].slug')
  for URL in "http://127.0.0.1:4173/" "http://127.0.0.1:4173/product/$SLUG"; do
    npx lighthouse "$URL" --only-categories=performance,accessibility,seo --form-factor=mobile --screenEmulation.mobile \
      --chrome-flags="--headless --no-sandbox" --output=json --output-path="$SCRATCH/lh-$(echo $URL | md5sum | cut -c1-8).json" --quiet
  done
  ```
  Expected: perf, a11y, seo each ≥ 90 on both pages; LCP < 2500 ms. Fallbacks if Chrome fails: Playwright's bundled Chromium with the same flags; Lighthouse against local Chrome through an SSH tunnel; PageSpeed Insights.
- [ ] **6.5 Smoke flow** (port 4173): log in at `/admin/login`; create a product with one variant and one WebP image; see it on `/products`; add to cart; place order (`201`); open the WhatsApp link; set status `new → confirmed`; a 6th order from the same IP returns `429`. Record results in `manifest.json` `test_results`.

**Gate:** 6.1–6.5 pass and `manifest.json` records the numbers.

---

## Phase 7 — Cloudflare deploy

**Owner:** verifier. Runs only after explicit user approval and with `CLOUDFLARE_API_TOKEN` in the environment. The token is never written to a file.
**Paths:** config values only in `backend/wrangler.toml` and `frontend/public/_redirects` (R10, R17).

- [ ] **7.1 Provision:** `npx wrangler d1 create beauty-store --config backend/wrangler.toml` (copy `database_id` into `wrangler.toml`); `npx wrangler d1 migrations apply beauty-store --remote --config backend/wrangler.toml`; `npx wrangler r2 bucket create beauty-store-images`.
- [ ] **7.2 Secrets and seed:** `npx wrangler secret put SESSION_SECRET --config backend/wrangler.toml`; `npx tsx backend/scripts/seed.ts --mode=remote`; `npx wrangler d1 execute beauty-store --remote --config backend/wrangler.toml --file backend/seed/seed.sql`.
- [ ] **7.3 Deploy:**
  - Worker: `npx wrangler deploy --config backend/wrangler.toml` → `https://beauty-store-api.<subdomain>.workers.dev` (default subdomain only).
  - Frontend `frontend/public/_redirects` (proxy rules above the SPA fallback):
    ```
    /api/*     https://beauty-store-api.<subdomain>.workers.dev/api/:splat    200
    /images/*  https://beauty-store-api.<subdomain>.workers.dev/images/:splat  200
    /*         /index.html   200
    ```
  - `npm run build -w frontend`; `npx wrangler pages project create beauty-store` (first time); `npx wrangler pages deploy frontend/dist --project-name beauty-store` → `https://<project>.pages.dev`.
- [ ] **7.4 Production smoke** (against `https://<project>.pages.dev`):
  - `/api/products` has `Cache-Control: public, s-maxage=300, stale-while-revalidate=60`.
  - `/images/<known-key>` has `public, max-age=31536000, immutable`.
  - `/admin/login` returns 200.
  - Failed login sets no cookie; successful login sets cookies with `Secure`.
  
  Orchestrator records the URL in `manifest.json`.

**Gate:** production smoke passes. A custom domain is optional; document it in README.md only.

---

## Review Focus

1. **Money integrity.** Owners 2.1, 2.3, 3.6. Check: tampered `total_paise` → 400.
2. **Auth cookie and hash.** Owners 4.1, 4.2. Check: cookie tests for both schemes; iterations 100000.
3. **CSRF and rate limits.** Owners 4.4, 3.6, 4.3. Check: route enumeration test; 6th order → 429.
4. **Stale edge cache.** Owners 4.7, 3.5. Check: purge spy tests; old and new slugs purged.
5. **Upload path and format.** Owners 4.6, 5c. Check: `..` → 400; `.jpg` key with `image/webp` → 400; PNG fallback yields JPEG.

## Gaps and Open Items

1. **Node 22 not installed.** Blocks Phase 1 onward. Open (user action, Task 0.1).
2. **Resolved:** production domain (R10); Lighthouse Chromium (R12, re-verify at first 6.4 run); order POST limit (R16); limit values R7 and R8 (approved).
3. **Admin account count.** One account (spec). Rotation is manual via `hash-password.ts`. Open, no change.
4. **Category management.** Out of v1 (R9).
5. **Same-origin production proxy (R17).** Architect decision, not explicitly approved. User to confirm before Phase 7.
6. **Rate-limit rename (R16).** Approved deviation from the spec's `login_attempts`.
