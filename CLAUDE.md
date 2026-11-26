# Beauty Parlour & Ladies' Clothing Store — Project Instructions

Mobile-first e-commerce and services site for a small beauty parlour and ladies' clothing business in India. Target production: 100% Cloudflare Free Tier (Pages, Workers, D1, R2).

## Status
- Current phase: **Phase 5 verified** (frontend storefront + admin). Phase 6 NOT started: awaiting user approval.
- Node v22.23.5 and npm 10.9.9 installed.
- Git: local only, no remote. Working branch is `dev`.

## Workspace Layout (planned, not yet created)
- `/frontend` — React + Vite + TypeScript (strict), Tailwind, React Router → Cloudflare Pages
- `/backend` — TypeScript + Hono on Cloudflare Workers (`/api/*`, `/images/*`); D1 migrations in `backend/migrations/`
- `/shared` — Zod schemas, paise formatters, WhatsApp builders
- `/README.md` — root readme
- `docs/superpowers/specs/` — approved design spec
- `docs/superpowers/plans/implementation-plan.md` — phased plan

## Source-of-Truth Files (read before writing code)
- `.claude/architecture.md` — request/cache flow, proxy topology, auth/CSRF, route tree, i18n/tokens
- `.claude/schema.md` — D1 DDL, migrations, `/api/*` Zod contracts
- `.claude/manifest.json` — phase status, files, migrations, endpoints, env vars, test results
- `.claude/scratchpad.md` — decisions, handoffs, blockers

## Non-Negotiable Rules
- **Money:** INTEGER paise everywhere. Never floats.
- **Worker CPU:** Never resize/transcode images in the Worker. `thumb` + `full` are made client-side in `/admin` (canvas / `createImageBitmap`) before R2 upload. Encode WebP (q 0.82 full, 0.75 thumb); if the browser falls back, re-encode JPEG at q 0.82. Accept only `image/webp` or `image/jpeg`; store the actual Content-Type in R2 metadata. Do not reject any browser. Output limits: `full` ≤ 3 MB, `thumb` ≤ 300 KB.
- **Caching:** Public `GET /api/products`, `/api/categories`, `/api/services`, `/api/settings` send `Cache-Control: public, s-maxage=300, stale-while-revalidate=60`; admin mutations purge via `caches.default`.
- **R2 images:** `Cache-Control: public, max-age=31536000, immutable`.
- **No** KV, Durable Objects, Queues, Docker, or `docker-compose.yml`. Zero paid dependencies.
- **Auth cookie:** `HttpOnly`, `SameSite=Strict`, HMAC-SHA256 signed; `Secure` only when `request.url.startsWith('https://')`.
- **CSRF:** double-submit token on all admin mutations.
- **Rate limits:** D1 table `rate_limits(key, attempted_at)`. Keys `login:<ip_hash>` (5 failed logins per 15 min) and `order:<ip_hash>` (5 orders per 15 min). Blocked requests get `429` with `Retry-After: 900`.
- **Bookings:** out of v1 scope (schema only).

## Commands (to be finalized in Phase 1)
- Install: `npm install` (root, workspaces)
- Dev: `npx wrangler dev` (backend, 127.0.0.1:8787) and `npm run dev -w frontend` (Vite, 127.0.0.1:5173)
- Test: `npm test` (Vitest + Miniflare)
- Typecheck: `npx tsc --noEmit -p <workspace>`
- Deploy: headless, using `CLOUDFLARE_API_TOKEN` (Phase 7 only); default `*.pages.dev` and `*.workers.dev` subdomains, no custom domain required

## Phase Gate
Each phase ends with: sync all five state files, summarize changes plus verification commands, and wait for explicit user approval before the next phase.
