# Schema Contract — Beauty Store v1

Locked contract between `backend/`, `shared/` and `frontend/`. Changing a table, column, route or Zod schema name requires a new migration file and an update here first.

Source: `docs/superpowers/specs/2026-11-26-beauty-store-v1-design.md` (Data Model, Features).

## Conventions

- Money: `INTEGER` paise only. `₹1,299` is stored as `129900`. No `REAL`, no `TEXT` money.
- Timestamps: `TEXT` ISO-8601 UTC, e.g. `2026-11-26T10:00:00.000Z`, default `(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`. Exception: `rate_limits.attempted_at` is `INTEGER` epoch milliseconds (approved, for window math).
- Booleans: `INTEGER` 0/1 with CHECK.
- Primary keys: `INTEGER PRIMARY KEY` (rowid alias).
- Indexes required by spec: `category_id`, `slug`, `is_active`, `status`, `created_at`. A `UNIQUE` column gets an automatic SQLite index, so `slug` needs no extra `CREATE INDEX`. `idx_rate_limits_key_time` is an extra index for the rate limiter (not in spec).
- D1 enforces foreign keys by default. Do not emit `PRAGMA foreign_keys` (D1 rejects it).

## Migration History

| File | Purpose | Status |
|---|---|---|
| `backend/migrations/0001_init.sql` | All v1 tables and indexes (DDL below) | Phase 3 |

Rules:
- Migrations are append-only. Never edit `0001_init.sql` after it has been applied to any remote D1.
- Seed data is NOT a migration. It lives in `backend/scripts/seed.ts` and emits `backend/seed/seed.sql` (local) or a reference-only subset (remote, see Seed below).

## D1 DDL (`backend/migrations/0001_init.sql`)

```sql
CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('product', 'service')),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',                       -- comma-separated, lowercase
  mrp_paise INTEGER NOT NULL CHECK (mrp_paise >= 0),
  price_paise INTEGER NOT NULL CHECK (price_paise >= 0 AND price_paise <= mrp_paise),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_created_at ON products(created_at);

CREATE TABLE product_variants (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  colour TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  UNIQUE (product_id, size, colour)
);
CREATE INDEX idx_variants_product_id ON product_variants(product_id);

CREATE TABLE product_images (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL UNIQUE,                         -- full image (WebP, or JPEG fallback), e.g. products/12/<uuid>-full.webp or ...-full.jpg
  thumb_r2_key TEXT NOT NULL,                          -- same format as r2_key, e.g. products/12/<uuid>-thumb.webp
  alt_text TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_images_product_sort ON product_images(product_id, sort_order);

CREATE TABLE services (
  id INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  price_paise INTEGER NOT NULL CHECK (price_paise >= 0),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);
CREATE INDEX idx_services_category_id ON services(category_id);
CREATE INDEX idx_services_is_active ON services(is_active);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  address TEXT NOT NULL,
  items_json TEXT NOT NULL CHECK (json_valid(items_json)),
  total_paise INTEGER NOT NULL CHECK (total_paise >= 0),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'confirmed', 'delivered', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);

CREATE TABLE settings (
  key TEXT PRIMARY KEY CHECK (key IN ('business_name', 'whatsapp_number', 'address', 'opening_hours', 'banner_text')),
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE admin_users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL                          -- pbkdf2-sha256$100000$<saltB64>$<hashB64>
);

CREATE TABLE rate_limits (
  key TEXT NOT NULL,                                   -- 'login:<ip_hash>' or 'order:<ip_hash>'; ip_hash = hex SHA-256 of client IP
  attempted_at INTEGER NOT NULL                        -- epoch milliseconds (UTC)
);
CREATE INDEX idx_rate_limits_key_time ON rate_limits(key, attempted_at);

CREATE TABLE bookings (                                -- schema only in v1; no routes
  id INTEGER PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'cancelled'))
);
CREATE INDEX idx_bookings_service_id ON bookings(service_id);
CREATE INDEX idx_bookings_status ON bookings(status);
```

### Column notes

- `products.tags`: stored lowercase, comma-separated. Search matches `name LIKE` or `tags LIKE` (escaped).
- `product_variants.stock`: decremented nowhere in v1 (no inventory reservation). Admin sets it manually.
- `items_json` shape (array): `[{ "product_id": number, "variant_id": number, "name": string, "size": string, "colour": string, "qty": number, "unit_price_paise": number }]`. `unit_price_paise` is read from D1 at order time, never from the client.
- `orders.total_paise` = sum of `unit_price_paise * qty`, computed server-side.
- `rate_limits`: one row per failed login (`login:<ip_hash>`) and per accepted order (`order:<ip_hash>`). Each check counts the key's rows in the last 15 min. Limits: login 5 failures, order 5 orders. Rows older than 24 h are pruned on every insert. A successful login deletes its `login:` rows.
- `settings` keys are fixed to the five in the spec. Values are plain text.

### Seed (not a migration)

- Local (`wrangler dev` state): `backend/scripts/seed.ts` is deterministic (PRNG seed `42`) and generates ~50–150 products, ~20–30 services, categories, five settings rows, one `admin_users` row, and placeholder WebP/SVG objects in local R2.
- Remote (Phase 7): only categories, settings and the admin row. No sample products or services.

## API Contract (`/api/*`, `/images/*`)

### Conventions

- Error envelope, all non-2xx JSON: `{ "error": { "code": string, "message": string, "fields"?: Record<string, string> } }`.
- Error codes: `validation_failed` (400), `unauthorized` (401), `csrf_failed` (403), `not_found` (404), `conflict` (409), `rate_limited` (429, with `Retry-After`), `internal` (500).
- Auth column: `public` = no cookie needed; `session` = valid `bs_admin` cookie; `session+csrf` = session cookie AND header `X-CSRF-Token` equal to `bs_csrf` cookie.
- Cache column values are exact header strings:
  - `PUBLIC` = `public, s-maxage=300, stale-while-revalidate=60`
  - `IMMUTABLE` = `public, max-age=31536000, immutable`
  - `NO_STORE` = `no-store`
- Zod request schemas live in `shared/src/schemas/` and are imported by both backend and frontend.
- Public list endpoints accept query strings. Cache keys include the query string, so each variant is cached separately. See purge rule below.

### Shared DTO names

`CategoryDto`, `ProductSummaryDto`, `ProductDetailDto`, `VariantDto`, `ImageDto`, `ServiceDto`, `OrderDto`, `AdminProductDto`, `SettingsMap`, `DashboardDto`.

### Public endpoints

| Method | Path | Auth | Cache | Request schema | Response (2xx) |
|---|---|---|---|---|---|
| GET | `/api/categories` | public | `PUBLIC` | none | `200 { categories: CategoryDto[] }` |
| GET | `/api/products` | public | `PUBLIC` | `ProductListQuerySchema` (`category?`, `q?`, `min_price?`, `max_price?`, `size?`, `colour?`, `in_stock?`, `sort?` in {`newest`,`price_asc`,`price_desc`,`popularity`}, `page?`, `per_page?` max 48) | `200 { items: ProductSummaryDto[], page, per_page, total }` |
| GET | `/api/products/:slug` | public | `PUBLIC` | none | `200 { product: ProductDetailDto }`, `404 not_found` |
| GET | `/api/services` | public | `PUBLIC` | none | `200 { services: ServiceDto[] }` (each includes `category: { id, name, slug }`) |
| GET | `/api/settings` | public | `PUBLIC` | none | `200 { settings: SettingsMap }` |
| POST | `/api/orders` | public | `NO_STORE` | `CreateOrderSchema` (`customer_name`, `customer_phone`, `address`, `items: CartItemSchema[]`; no price or total accepted) | `201 { id, status: "new", total_paise, items_count }`; `429 rate_limited` with `Retry-After: 900` after 5 orders in 15 min per IP hash |
| GET | `/images/*` | public | `IMMUTABLE` | none | `200` image bytes from R2 `IMAGES` binding, `404` if missing |

`ProductSummaryDto` contains: `id, name, slug, category_slug, mrp_paise, price_paise, percent_off, tags, in_stock, created_at, thumb_url`. `ProductDetailDto` adds `description`, `variants: VariantDto[]`, `images: ImageDto[]`. `percent_off` is an integer.

### Admin endpoints

| Method | Path | Auth | Cache | Request schema | Response (2xx) | Purges public cache |
|---|---|---|---|---|---|---|
| POST | `/api/admin/login` | public, rate-limited | `NO_STORE` | `LoginSchema` (`username`, `password`) | `200 { username }` + `Set-Cookie` for `bs_admin` and `bs_csrf`; `401 unauthorized`; `429 rate_limited` | no |
| POST | `/api/admin/logout` | session+csrf | `NO_STORE` | none | `204`, clears both cookies | no |
| GET | `/api/admin/session` | session | `NO_STORE` | none | `200 { username }` | no |
| GET | `/api/admin/dashboard` | session | `NO_STORE` | none | `200 DashboardDto` (`counts: { new, confirmed, delivered, cancelled }`, `recent_orders: OrderDto[]` max 10) | no |
| GET | `/api/admin/products` | session | `NO_STORE` | `AdminProductListQuerySchema` (`page?`, `per_page?`, `q?`) | `200 { items: AdminProductDto[], page, per_page, total }` (includes inactive) | no |
| POST | `/api/admin/products` | session+csrf | `NO_STORE` | `ProductCreateSchema` | `201 { product: AdminProductDto }` | yes |
| PUT | `/api/admin/products/:id` | session+csrf | `NO_STORE` | `ProductUpdateSchema` (partial) | `200 { product: AdminProductDto }`, `404`, `409 conflict` on duplicate slug | yes (old and new slug) |
| DELETE | `/api/admin/products/:id` | session+csrf | `NO_STORE` | none | `204`; also deletes the product's R2 objects | yes |
| POST | `/api/admin/products/:id/variants` | session+csrf | `NO_STORE` | `VariantCreateSchema` | `201 { variant: VariantDto }`, `409` on duplicate size+colour or sku | yes |
| PUT | `/api/admin/variants/:id` | session+csrf | `NO_STORE` | `VariantUpdateSchema` (partial, includes `stock`) | `200 { variant: VariantDto }` | yes |
| DELETE | `/api/admin/variants/:id` | session+csrf | `NO_STORE` | none | `204` | yes |
| PUT | `/api/admin/uploads?key=<r2Key>` | session+csrf | `NO_STORE` | raw body, `Content-Type` `image/webp` or `image/jpeg` matching the key extension, `UploadKeySchema` on `key` (`^products/\d+/[0-9a-f-]{36}-(full|thumb)\.(webp|jpg)$`), body ≤ 3 MB for `full` or ≤ 300 KB for `thumb` (approved limits) | `201 { key, size }`; `413 validation_failed` on size | no |
| POST | `/api/admin/products/:id/images` | session+csrf | `NO_STORE` | `ImageCreateSchema` (`full_r2_key`, `thumb_r2_key`, `alt_text`, `sort_order`) | `201 { image: ImageDto }` | yes |
| DELETE | `/api/admin/products/:id/images/:imageId` | session+csrf | `NO_STORE` | none | `204` | yes |
| POST | `/api/admin/services` | session+csrf | `NO_STORE` | `ServiceCreateSchema` | `201 { service: ServiceDto }` | yes |
| PUT | `/api/admin/services/:id` | session+csrf | `NO_STORE` | `ServiceUpdateSchema` (partial) | `200 { service: ServiceDto }` | yes |
| DELETE | `/api/admin/services/:id` | session+csrf | `NO_STORE` | none | `204` | yes |
| GET | `/api/admin/orders` | session | `NO_STORE` | `OrderListQuerySchema` (`status?`, `page?`, `per_page?`) | `200 { items: OrderDto[], page, per_page, total }` | no |
| PATCH | `/api/admin/orders/:id/status` | session+csrf | `NO_STORE` | `OrderStatusUpdateSchema` (`status`) | `200 { order: OrderDto }`, `409 conflict` on illegal transition | no |
| PUT | `/api/admin/settings` | session+csrf | `NO_STORE` | `SettingsUpdateSchema` (partial map of the five keys) | `200 { settings: SettingsMap }` | yes |

Order status transitions (enforced server-side): `new` → `confirmed` | `cancelled`; `confirmed` → `delivered` | `cancelled`. `delivered` and `cancelled` are terminal.

### Phase 4 additions

Read routes added so the admin editors have a source for inactive records. Session only (no CSRF), `no-store`, same error envelope.

| Method | Path | Auth | Cache | Request schema | Response (2xx) | Purges public cache |
|---|---|---|---|---|---|---|
| GET | `/api/admin/products/:id` | session | `NO_STORE` | none | `200 { product: AdminProductDto }` (includes inactive, variants, images); `404 not_found` | no |
| GET | `/api/admin/services` | session | `NO_STORE` | none | `200 { services: ServiceDto[] }` (includes inactive, each with `category`) | no |
| GET | `/api/admin/services/:id` | session | `NO_STORE` | none | `200 { service: ServiceDto }` (includes inactive); `404 not_found` | no |

Response schemas: `AdminProductResponseSchema`, `AdminServicesResponseSchema`, `AdminServiceResponseSchema` in `shared/src/schemas/admin.ts`.

### Cookies

| Name | HttpOnly | SameSite | Secure | Path | Value |
|---|---|---|---|---|---|
| `bs_admin` | yes | Strict | only if `request.url.startsWith('https://')` | `/` | `<base64url(JSON {sub, exp})>.<base64url(HMAC-SHA256)>`, key = `SESSION_SECRET`, lifetime 8 h |
| `bs_csrf` | no | Strict | same rule | `/` | 32 random bytes, hex; issued at login |

### Purge rule (`caches.default`)

On each mutation marked "yes" above, the backend deletes these exact keys (origin + path, no query): `/api/categories`, `/api/products`, `/api/services`, `/api/settings`, `/api/products/<slug>` for every affected product (old and new slug). Query-string variants of list endpoints are not enumerated; they expire on their own within `s-maxage=300`.

## Additional route (Phase 3 audit)
- `GET /api/health` — returns `{"ok": true}`. Not part of the public contract table; used for smoke checks only.
