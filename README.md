# Beauty Parlour & Ladies' Clothing Store

Mobile-first storefront and admin for a small beauty parlour and ladies' clothing business in India. Runs entirely on the Cloudflare Free Tier (Pages, Workers, D1).

## Prerequisites

- Node.js 22 LTS (`node --version` should print `v22.*`)
- npm 10 or later

## Layout

| Workspace                | Path        | Purpose                                                       |
| ------------------------ | ----------- | ------------------------------------------------------------- |
| `@beauty-store/shared`   | `shared/`   | Zod schemas, paise helpers, WhatsApp builders (no build step) |
| `@beauty-store/backend`  | `backend/`  | Hono API on Cloudflare Workers, D1 migrations                 |
| `@beauty-store/frontend` | `frontend/` | React + Vite + Tailwind storefront and `/admin`               |

Design docs: `docs/superpowers/specs/`, implementation plan: `docs/superpowers/plans/implementation-plan.md`, contracts: `.claude/schema.md` and `.claude/architecture.md`.

## Install

```sh
npm install
```

## Develop

Start the Worker and the Vite dev server together:

```sh
npm run dev
```

Or in two terminals:

```sh
npm run dev -w @beauty-store/backend    # wrangler dev on 127.0.0.1:8787
npm run dev -w @beauty-store/frontend   # Vite on 127.0.0.1:5173
```

Vite proxies `/api/*` and `/images/*` to `127.0.0.1:8787`, so the browser only uses `http://127.0.0.1:5173`.

## Preview from a laptop over SSH

The dev server binds to loopback only. From your machine:

```sh
ssh -L 5173:localhost:5173 ubuntu@<ec2-ip>
```

Then open `http://localhost:5173`.

## Quality checks

```sh
npm run typecheck   # tsc --noEmit in every workspace
npm test            # Vitest in every workspace
npm run lint        # ESLint (typescript-eslint recommended)
npm run format:check
```

## Deploy

Live deployment (Phase 8 storefront reskin deployed; Phase 7 backend unchanged):

- Storefront: https://noora-studio.pages.dev (Pages project `noora-studio`)
- API: https://noora-api.tridev-g811.workers.dev (Worker `noora-api`, D1 `noora-db`)
- Images are stored as WebP/JPEG blobs in D1 (no R2, so no card is needed).
- Deploy: `npx wrangler login --device --browser=false`, then `npx wrangler deploy` in `backend/` and `cd frontend && npx wrangler pages deploy dist --project-name=noora-studio --branch=main` (run from `frontend/` so the Pages Functions bundle is included).

The default `*.pages.dev` and `*.workers.dev` subdomains are used. A custom domain is optional and can be bound later in the Cloudflare dashboard. Admin credentials are not in this repo. Rotate the admin password after first login.
