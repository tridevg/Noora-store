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
