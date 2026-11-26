# Beauty Parlour & Ladies' Clothing Store — v1 Design Spec

**Date:** 2026-11-26
**Status:** Approved for planning (pending orchestrator approval gate)

## Overview

Build a mobile-first e-commerce and services website for a small **beauty parlour and ladies' clothing business** in India.

- **Visual Direction:** Modern fashion-beauty marketplace inspired by Nykaa's editorial layout patterns (generous whitespace, strong typography, restrained accent palette + neutrals, rounded product cards) with original branding.
- **Monorepo Layout:** npm workspaces (`/frontend`, `/backend`, `/shared`) + root `README.md`.

## Hard Cloudflare Free-Tier Constraints

- Zero paid services/dependencies. No KV, no Durable Objects, no Queues.
- **10 ms Worker CPU limit:** Never resize/transcode images inside the Worker. Perform client-side image compression and WebP conversion (`thumb` + `full`) in the `/admin` browser UI using `<canvas>` / `createImageBitmap` before uploading to R2.
- **Edge Caching:** Public `GET /api/products`, `/api/categories`, `/api/services`, and `/api/settings` return `Cache-Control: public, s-maxage=300, stale-while-revalidate=60` and purge matching cache entries via `caches.default` on any admin mutation.

## Stack

- `/frontend`: React + Vite + TypeScript (`strict: true`), Tailwind CSS, React Router (Cloudflare Pages).
- `/backend`: TypeScript + Hono on Cloudflare Workers (`/api/*`, `/images/*`). No Python/FastAPI.
- `/shared`: Shared TypeScript types, Zod schemas, integer-paise currency formatters (`₹1,299`), and WhatsApp message/URL builders.
- **Database:** Cloudflare D1 (SQLite) with versioned SQL migrations (`backend/migrations/0001_init.sql`).
- **Storage:** Cloudflare R2 for images with `Cache-Control: public, max-age=31536000, immutable`.

## Scope Defaults

- **Bookings:** Out of scope for v1 (schema-ready `bookings` table only; service cards have an **"Enquire on WhatsApp"** CTA).
- **i18n:** English default in `frontend/src/i18n/en.ts`, structured so Hindi (`hi.ts`) can be added later without component refactors.
- **Seed Data:** Deterministic local seed script generating ~50–150 sample products, ~20–30 services, default settings, dev admin user, and valid local placeholder WebP/SVG product images in local R2 state.
- **Admin Auth:** Single admin account using PBKDF2 (`Web Crypto API`, 100,000 iterations) password hash in `.dev.vars` / Wrangler secret + D1, issuing an `HMAC-SHA256` signed `HttpOnly`, `SameSite=Strict` cookie, with D1-based login rate limiting (5 failed attempts per 15 minutes per IP hash) and CSRF double-submit token protection on all admin mutations.
- **Order Limit:** `POST /api/orders` is capped at 5 orders per 15 minutes per IP hash, using the same rate-limit table.
- **Image Uploads:** Output limits are `full` ≤ 3 MB and `thumb` ≤ 300 KB. If the browser cannot encode WebP, output falls back to JPEG (quality 0.82). Browsers are not rejected.
- **Initial JS Budget:** Under 150 KB gzipped (read as 150,000 bytes).

## Data Model

All money in `INTEGER` paise, never floats. Index `category_id`, `slug`, `is_active`, `status`, `created_at`.

- `categories(id, name, slug, type, sort_order)`
- `products(id, category_id, name, slug, description, tags, mrp_paise, price_paise, is_active, created_at, updated_at)`
- `product_variants(id, product_id, size, colour, sku, stock)`
- `product_images(id, product_id, r2_key, thumb_r2_key, alt_text, sort_order)`
- `services(id, category_id, name, slug, description, price_paise, duration_minutes, is_active)`
- `orders(id, customer_name, customer_phone, address, items_json, total_paise, status, created_at)`
- `settings(key, value)` (`business_name`, `whatsapp_number`, `address`, `opening_hours`, `banner_text`)
- `admin_users(id, username, password_hash)`
- `rate_limits(key, attempted_at)` (keys `login:<ip_hash>` and `order:<ip_hash>`; replaces the earlier `login_attempts` table, a deliberate approved deviation)
- `bookings(id, service_id, customer_name, phone, starts_at, status)` (schema only)

## Features (v1)

1. **Home (`/`):** Hero banner (`settings.banner_text`), category tiles, featured products, popular services preview, floating WhatsApp button.
2. **Catalog (`/products`, `/category/:slug`):** Responsive grid, filter drawer/bar (category, price range, size, colour, in-stock), sort (newest, price asc/desc, popularity), pagination.
3. **Product Detail (`/product/:slug`):** Gallery with click/pinch zoom, size & colour selectors updating stock, MRP strikethrough + price + `% OFF`, description, "Add to Cart".
4. **Services (`/services`):** Grouped by category with duration, price, description, "Enquire on WhatsApp".
5. **Cart & WhatsApp Checkout (`/cart`):** `localStorage` cart, quantity controls, customer name/phone/address inputs (Zod validated), subtotal, **"Place Order on WhatsApp"** (`POST /api/orders` to D1 first with zero payment data, then open `https://wa.me/<whatsapp_number>?text=<encoded>` with Order ID, items, total, address, and `Cash / UPI on Delivery`).
6. **Search:** Debounced header search by product name and tags.
7. **Admin (`/admin`):** Protected `/admin/login`, Dashboard (order counts + recent orders), Products CRUD + variants + client-side WebP multi-image R2 upload, Services CRUD, Orders status manager (`new` → `confirmed` → `delivered` / `cancelled`), Settings editor.
8. **Navigation & Static Pages:** Sticky header, fixed mobile bottom nav (`Home`, `Categories`, `Services`, `Cart`, `WhatsApp`), `/about`, `/contact` (map link, phone, WhatsApp), `/shipping-returns`, `/privacy-policy`.

## Quality & Performance Targets

- Lighthouse mobile ≥ 90 (Performance, Accessibility, SEO) on Home and Product pages.
- LCP < 2.5s on mid-range 4G.
- Route-level `React.lazy()` splitting.
- Initial JS bundle **< 150 KB gzipped**.
- Centralized design tokens (`frontend/src/styles/tokens.css`).
- Unit tests (cart, paise formatting, WhatsApp message builder) + Vitest/Miniflare API integration tests.

## Execution Environment

- **No Docker.** Run `wrangler dev` (native `workerd` + local `.wrangler/state` SQLite D1 and local R2) and `vite` directly on EC2. No Dockerfiles or `docker-compose.yml`.
- **Single SSH tunnel preview:** Vite (`127.0.0.1:5173`) proxies `/api/*` and `/images/*` to Wrangler (`127.0.0.1:8787`). Preview from MacBook via `ssh -L 5173:localhost:5173 ubuntu@<ec2-ip>` at `http://localhost:5173`, zero CORS issues.
- **Headless Linux adjustments:**
  - Set `Secure` on the admin auth cookie **only** when `request.url.startsWith('https://')`.
  - Use `CLOUDFLARE_API_TOKEN` for headless Wrangler deployment in the final phase.
  - Production uses default subdomains only (`*.pages.dev` for the SPA, `*.workers.dev` for the API, `/images/*` through the Worker). No custom domain is required.
  - Phase 6 Lighthouse audits use headless Chrome from `npx @puppeteer/browsers install chrome@stable`, not Ubuntu's system Chromium (`--chrome-flags="--headless --no-sandbox"`).
