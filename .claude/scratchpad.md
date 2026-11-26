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
