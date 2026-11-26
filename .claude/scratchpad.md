# Engineering Scratchpad

## 2026-11-26 — Phase 0

### Environment audit (done by orchestrator)
- Ubuntu 26.04.1, kernel 7.0.0-1018-aws, glibc 2.43 (≥ 2.35 required for workerd: OK).
- git 2.53.0 installed; `git init` run in repo (branch `master`, no commits yet).
- Node.js and npm: installed by user (v22.23.5, npm 10.9.9). Blocker resolved.
  - Attempted NodeSource 22.x setup + apt install via sudo. **Denied by auto-mode classifier.** Not retried.
  - Needs user action. Suggested: type `! <command>` in the prompt, or grant a Bash permission rule, then re-run.
- Chromium: missing (needed only for Phase 6 Lighthouse).
- 2 vCPU, 3.7 GB RAM, 45 GB free disk.

### Decisions
- Spec saved verbatim to `docs/superpowers/specs/2026-11-26-beauty-store-v1-design.md`.
- Deviation from the prompt: the prompt named `env-explorer` / `architect` subagents. Env exploration was done inline (small, no heavy work). `architect` ran as a general-purpose subagent for the plan and the two `.claude/*` docs.
- The prompt says `ARCHITECTURE.md` and `SCHEMA.md`. The enforcement rules name `.claude/architecture.md` and `.claude/schema.md`. Using the `.claude/` paths.

### Handoffs
- architect → `docs/superpowers/plans/implementation-plan.md`, `.claude/architecture.md`, `.claude/schema.md` (in progress).

### Blockers
- None. Node installed (resolved 2026-11-26).

### Next-step checklist
- [ ] User installs Node 22 LTS (or grants permission for the orchestrator to do it).
- [ ] Review `docs/superpowers/plans/implementation-plan.md`.
- [ ] Review `.claude/architecture.md` and `.claude/schema.md`.
- [ ] Approve Phase 1 start.

## 2026-11-26 — Decisions locked (user approval)
- Architect defaults approved (see manifest.decisions).
- Browser WebP fallback accepted (no Safari rejection).
- Order rate limit via rate_limits table; deviates from spec's login_attempts name (approved).
- Phase 7 default subdomains only; Lighthouse without snap Chromium.
- Plan trimmed to ~200–250 lines.
- Phase 1 scaffold, then commit Phase 0 and 1; stop before Phase 2.

## 2026-11-26 — Phase 2 approval and note
- User approved Phase 2 explicitly. Recorded in manifest.json (phase_approvals) and CLAUDE.md.
- First Phase 2 builder stopped because the state files still said "wait for approval". Re-dispatched after the files were updated.
- Lesson: when the user approves a phase, update the state files before dispatching subagents, and tell them in the prompt that approval exists.
- Git identity for commits: Tridev <tridevguha17@gmail.com>, passed per command (see memory git-commit-identity).

## Queued sequence (user instruction)
1. Finish Phase 4 cleanly: builder adds GET /api/admin/products/:id, GET /api/admin/services, GET /api/admin/services/:id (documented in schema.md "Phase 4 additions"); verifier; commit.
2. Build Phase 5 (frontend shell, then storefront and admin builders in parallel); verifier; commit.
3. Smoke-test readiness: `npm run dev` on both 8787 and 5173, D1 seeded, /images/* resolving. Print the local admin credentials and the ssh -L 5173:localhost:5173 command. WAIT for user go-ahead.
4. Phase 6 (static pages, SEO, a11y, Lighthouse, bundle < 150 KB gz). STOP before Phase 7.
Open: R17 (_redirects proxy for Phase 7) not approved. Lighthouse needs a Chromium that is not yet installed.


## Phase 5 verified (2026-11-26)
- Verifier PASS. Initial JS 134,547 bytes gzip.
- Flag: money conversions in frontend (components/admin/money.ts, components/storefront/catalogQuery.ts) use rupees*100 and toFixed(2) for display. Integer-safe. Reviewed, not blocking.
- Gaps carried to Phase 6 or later: placeholder static pages; stock not enforced at cart or checkout; WhatsApp message uses cart prices while the server total is authoritative; window.open after await can be pop-up blocked; admin image orphan cleanup and reorder/alt-text endpoints absent.
- Next: Phase 6 requires user approval. Smoke-test readiness step still pending.


## Phase 7 deployed and state synced (2026-11-26)
- Worker noora-api (D1 noora-db) and Pages noora-studio are live. Temporary Pages project `noora` (noora-2yi.pages.dev) deleted.
- Images are D1 blobs. R2 removed. Full cap 500 KB, thumb 300 KB.
- Admin origin allowlist added (403 for unknown Origin, `csrf_failed`). Review pending.
- Lighthouse live: product Perf 92 / LCP 1.81 s; home Perf 96 / LCP 0.84 s.
- Open: admin password rotation (was printed in transcript); remove unused ADMIN_PASSWORD_HASH secret or wire it up; apt browser libs left installed; npm audit 6 high; no git remote.
- Report: /home/ubuntu/report.txt. Credentials: /home/ubuntu/admin.txt (outside repo).


## Phase 7 signed off (user)
- Kept: apt browser support libs; origin allowlist; Pages Functions proxy; D1 WebP blobs.
- User is rotating the admin password, deleting /home/ubuntu/admin.txt, and removing the unused ADMIN_PASSWORD_HASH secret.
- No Phase 8 needed now.


## Close-out (2026-11-26)
- All phases 0–7 complete. Phase 8 not planned by the user.
- Phase 6 partial at commit, home fixed on live in Phase 7.
- Admin password rotation by the user. admin.txt deleted by the user. ADMIN_PASSWORD_HASH secret removed; SESSION_SECRET remains.
- Apt browser-support libs kept. Playwright Chromium in user space.
- Docs synced: CLAUDE.md, manifest.json, plan close-out banner, README, endpoints.txt, scratchpad.
- Open for user: git remote (none); npm audit (6 high) triage; remove or keep apt libs (decided: keep).


## Phase 8 approved (2026-11-26)
- Scope: public storefront reskin (frontend only). Tokens per brief (Sage & Cream); Vite stays; template /tmp/storefront-template is reference only and must be removed before commit.
- Hero tiles: abstract CSS placeholders (no new image assets).
- Backend, D1, /admin, Origin/CSRF unchanged. Initial JS < 150,000 bytes gzip.
- Execution: subagents build; coordinator updates state files.


## 2026-11-26 — Phase 8 verified and deployed
- Approval: user approved Phase 8 (storefront reskin, frontend only, CSS placeholders for hero tiles, subagent-driven). Approval recorded in manifest.phase_approvals before builders ran.
- Builder work: Sage & Cream tokens in `frontend/src/index.css` (replaces `styles/tokens.css`); `components/ui/` primitives; storefront blocks (`HeroBentoBanner`, `CategoryRail`, `NewArrivalsGrid`, header, footer, bottom nav with live Bag count); bag drawer (`BagProvider`, `CartDrawer`, `useCheckout`, `useCartStock`); `/cart` kept as fallback. No backend, D1 or `/api/*` change.
- Gates: typecheck, lint, format:check, `npm test` 27/120/47 (shared/backend/frontend), build, check:bundle 118,836 bytes gzip (limit 150,000).
- Lighthouse mobile (live build): home Perf 94-98, A11y 100, SEO 100. Product `/product/oxidised-jhumka-earrings` Perf 91-92, A11y 100, SEO 100.
- Deploy incident 1: first deploy from git branch `dev` produced only a preview. Redeployed with `--branch=main`.
- Deploy incident 2: second deploy ran from repo root, which omitted `frontend/functions`, so `/api/*` and `robots.txt` served HTML. Fixed by deploying from the `frontend/` working directory (wrangler 4 reads `functions/` from cwd).
- Final deploy: production build `index-BTEby1bs`, deployment https://3e75dd7b.noora-studio.pages.dev.
- Product page CLS fixed: eager `ProductDetailPage` route, skeleton sizing, font fallbacks tuned, BottomNav slot kept stable while settings load.
- Open items:
  - Product LCP audit 2.8 s (Phase 7 was 1.81 s). Gallery image waits for the JS chunk and the product API. Remaining lever: preload the product API. Not done.
  - Nav link `/category/skincare` does not exist. Closest real slug is `skin`. Not changed (no source edits in this phase close-out).
  - Fallback font metrics tuned on Linux; needs a real-phone check.
  - Inter is named in `--bs-font-sans` but not loaded. Body text uses the system stack.
  - Google Fonts is a third-party dependency (Cormorant Garamond, Plus Jakarta Sans). Not self-hosted.
  - Button fill `#5E6D5F` chosen for AA contrast (white on `#7A8B7B` fails).

## 2026-11-26 — Phase 8 follow-up: skincare nav, product LCP, deploy, Lighthouse
- Skincare nav: header link changed from `/category/skincare` (no such slug) to `/category/skin`. Footer has no skincare link. `/category/skin` returns 200 and renders the "No products match these filters." notice (the API returns 0 items, not an error); heading shows the generic "Shop" title because `skin` is not a product category. `/category/makeup` (header) has the same problem: makeup is a service slug, so it shows the same empty state. Not changed; decide whether to point it elsewhere.
- LCP: `ProductGallery` main image gets `loading="eager"` (fetchpriority high, async decode, width/height already set). Thumbnails were already `loading="lazy"`. `index.html` already had both preconnects and the non-blocking stylesheet (media=print swap), so no change. No image preload: the URL is not known in the initial HTML.
- LCP result: no improvement. Audit breakdown shows resource load delay about 0.7-0.8 s (image discovered only after the product API responds), TTFB 45 ms, load duration 93 ms, render delay about 100 ms. The product API waterfall is the remaining lever; data loading was not changed per instructions.
- Deploy: `cd frontend && npx wrangler pages deploy dist --project-name=noora-studio --branch=main` to https://b6918996.noora-studio.pages.dev, build index-B-X-fxzR. `/api/settings` 200 application/json; `/robots.txt` 200 text/plain.
- Gates: typecheck 0, lint 0, format:check 0, npm test 27/120/47, build 0, check:bundle 118,838 bytes gzip (limit 150,000).
- Lighthouse mobile, 3 runs each, perf/a11y/seo, live site:
  - Product `/product/oxidised-jhumka-earrings` before: Perf 93/93/93, LCP 2.83/2.84/2.82 s, CLS 0. After: Perf 91/93/92, LCP 2.83/2.84/2.82 s, CLS 0. A11y 100, SEO 100 throughout.
  - Home `/` before: Perf 88/95/96, LCP 0.89/0.88/0.92 s. After: Perf 93/96/94, LCP 0.89/0.87/0.88 s. A11y 100, SEO 100.
- Open: product LCP still about 2.8 s against the 1.8 s target. Needs the product API to respond sooner (or a data-loading change, out of scope here). Fonts are not self-hosted; the stylesheet is not render-blocking.

## 2026-11-26 — Phase 8 follow-up 2: edge preload, nav repoint, Lighthouse
- Nav: header "Skincare" and "Makeup" now link to `/services` (no hash; services categories are admin-defined and the page has no per-category ids). React key changed from `to` to `label` because two links share a target.
- Edge preload: `frontend/functions/product/[slug].ts` (router path is `product/:slug`). It fetches `/api/products/:slug` from the Worker (2 s timeout), returns the SPA shell with a `Link` preload header and an injected `<link rel="preload">` for the first gallery image (imagesrcset/imagesizes match ProductGallery). `Cache-Control: no-cache`. Failures and 404s return the plain shell with its original status. The shell is fetched with `context.next(new Request('/'))`; `/index.html` is avoided because the asset handler 308-redirects it to `/`.
- Local check (`wrangler pages dev`): product page 200 with Link and preload tag; unknown product 200 shell (same as before).
- Deploy: `cd frontend && npx wrangler pages deploy dist --project-name=noora-studio --branch=main` to https://c91b5826.noora-studio.pages.dev, build index-C__s9c-a. Production verified: `/api/settings` 200 application/json, `/robots.txt` 200 text/plain, `/sitemap.xml` 200 application/xml, product page 200 with the Link header.
- Gates: typecheck 0, lint 0, format:check 0, npm test 27/120/47, build 0, check:bundle 118,832 bytes gzip (limit 150,000).
- Lighthouse mobile, 3 runs each (perf/a11y/seo). Product: Perf 94/93/92 (median 93), A11y 100, SEO 100, LCP 2835/2852/2841 ms (median 2.84 s), CLS 0. Home: Perf 93/95/96 (median 95), A11y 100, SEO 100, LCP 889/946/863 ms (median 0.89 s), CLS 0.038.
- Result: target NOT met. Product LCP median 2.84 s vs 1.8 s target. The preload works (the image request starts at about 0.53 s, before the JS bundle ends at about 1.34 s), but the element render delay is about 1.08 s because the `<img>` only mounts after the JS bundle and `GET /api/products/:slug` finish (about 1.6 s). Next lever: have the Pages Function inline the product JSON into the HTML and have ProductDetailPage use it, which is a frontend/src data-flow change. Not done; needs approval.

## 2026-11-26 — Product LCP decision: target waived, clean baseline
- User decision: the product-page LCP target (< 1.8 s) is waived for now. Baseline kept: commit `02b280d`, production deployment `https://c91b5826.noora-studio.pages.dev`, build `index-C__s9c-a`.
- Measured (Lighthouse mobile, 3 runs, live): product `/product/oxidised-jhumka-earrings` Perf 93 (median), A11y 100, SEO 100, LCP median 2.84 s, CLS 0. Home `/` Perf 95, LCP median 0.89 s.
- Rejected: inlining product JSON into the HTML from the Pages Function. Reason: product data (stock, price, variants) is edited in `/admin`. Inlined data would live in the cached HTML, so every stock or price edit would need HTML cache invalidation, and the HTML would be stale until purged. The single `GET /api/products/:slug` path keeps the public API cache (`s-maxage=300`, purged by admin mutations) as the only cache for product data.
- Consequence: the edge preload (`frontend/functions/product/[slug].ts`) stays as is. The product LCP stays about 2.8 s; no further LCP work is planned unless the user reopens it.

## 2026-11-26 — Session state / resume point
- Where we are: Phase 8 done. Production baseline live: commit 02b280d, build index-C__s9c-a, deployment c91b5826. Product LCP target waived by user; single API data path kept (no inlined product JSON). Docs committed at f18b2d5.
- Last commits: f18b2d5 (product LCP decision, clean baseline), 02b280d (edge preload product hero image; skin and makeup nav repointed to services), f2df097 (Phase 8 storefront reskin), 056c2aa (Phase 8 commit hash in manifest), 5945ba8 (skincare nav to /category/skin, product LCP eager image, preconnects).
- Open items:
  - Git push: user runs `! git push` (local dev is ahead of origin/dev).
  - Makeup and Skincare nav both point to /services (no per-category anchors).
  - Fallback font metrics tuned on Linux; need a real-phone check.
  - Google Fonts is a third-party dependency (Cormorant Garamond, Plus Jakarta Sans); not self-hosted.
  - Inter is named in `--bs-font-sans` but not loaded; body text uses the system stack.
  - npm audit reports 6 high vulnerabilities from earlier; not addressed.
  - Admin password rotation is the user's action.
  - Replace sample products and placeholder settings.
  - Admin hero tiles are placeholders.
- Resume with: "start from last state" -> run `git status -sb`, `git log --oneline -3`, confirm origin/dev status, and check the live baseline (bundle name, `/api/settings`, product page Link header).

## 2026-11-26 — Setup guide added (commit 5e76f1e)
- `setup.txt` added: macOS prerequisites (Node 22, npm), clone and `dev` branch, Cloudflare device login, connectivity checks (`wrangler whoami`, D1 and Pages lists, `/api/settings`, `/api/health`, `robots.txt`), local dev with `backend/.dev.vars`, tests, deploy from `backend/` and `frontend/` with `--branch=main`, and Lighthouse via user-space Playwright Chromium.
- No secrets in the file. Admin password stays out of the repo. Commit identity note only.
- Docs sync (2026-11-26): setup.txt paths and npm scripts checked against the repo; listed in CLAUDE.md Source-of-Truth and the README design-docs line.
