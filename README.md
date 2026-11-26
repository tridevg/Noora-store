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
npm test            # Vitest in every workspace (passes with no tests until Phase 2)
npm run lint        # ESLint (typescript-eslint recommended)
npm run format:check
```

## Deploy

Deployment to Cloudflare (Pages for the SPA, Workers for the API) is Phase 7. See the plan for the steps. The default `*.pages.dev` and `*.workers.dev` subdomains are used; no custom domain is required. A custom domain is optional and can be bound later in the Cloudflare dashboard.
