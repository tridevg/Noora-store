# Noora: MacBook Handoff

This guide moves development of the Noora store (beauty parlour and ladies' clothing, India) to an Apple Silicon MacBook. Read it top to bottom once. Companion files: `setup.txt` (full command list), `endpoints.txt` (API contract), `CLAUDE.md` (project rules).

## 1. What this is and current state

- Phase 8 (storefront reskin, Sage and Cream) is deployed. Phase 7 is signed off.
- Production baseline: commit `02b280d`, build `index-C__s9c-a`, deployment `c91b5826`.
- Dev branch tip at the time this guide was written: `f4206c1` (run `git log -1` for the current tip). Local `dev` is 8 commits ahead of `origin/dev` (`44df1b6`). The owner pushes `dev` from the MacBook.
- Product page LCP target (under 1.8 s) is waived by the owner. Measured median is about 2.8 s. The single API data path is kept: product data comes only from `GET /api/products/:slug`, with no inlined product JSON in HTML.
- Admin password rotation is the owner's action.

## 2. Live Cloudflare resources

| Resource | Exact value |
| --- | --- |
| Pages project | `noora-studio` |
| Pages production branch | `main` |
| Storefront | https://noora-studio.pages.dev |
| Worker | `noora-api` |
| API (Worker) | https://noora-api.tridev-g811.workers.dev |
| D1 database | `noora-db`, id `96eebef2-a1ec-42a1-b049-476a3257dee6` |
| Worker secret | `SESSION_SECRET` (name only) |

- The `SESSION_SECRET` value is not in the repo and must not be copied into any file or chat. To rotate it, run `npx wrangler secret put SESSION_SECRET` from `backend/`.
- The admin password is set by the owner. It is not in the repo and must stay out of files and chats.

## 3. MacBook setup (in order)

Run these in the Terminal app.

1. Install Xcode Command Line Tools:
   ```sh
   xcode-select --install
   ```
2. Install Homebrew with the official line from https://brew.sh:
   ```sh
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
3. Install Node 22:
   ```sh
   brew install node@22
   ```
   If `node@22` is not linked onto PATH, follow the caveats Homebrew prints, or use nvm (`brew install nvm`, then `nvm install 22` and `nvm use 22`).
4. Verify the versions. Node must be v22 or later:
   ```sh
   node -v
   npm -v
   ```
5. Clone the repo and switch to `dev`:
   ```sh
   git clone https://github.com/tridevg/Noora-store.git beauty-fashion-store
   cd beauty-fashion-store
   git checkout dev
   ```
6. Install all workspaces from the repo root:
   ```sh
   npm install
   ```
7. Set your own git identity for this Mac. Use your own name and email; do not reuse anyone else's:
   ```sh
   git config user.name "your name"
   git config user.email "your-email@example.com"
   ```
8. Log in to Cloudflare. This opens a browser on macOS, then confirm the account:
   ```sh
   npx wrangler login
   npx wrangler whoami
   ```
9. Push (the owner runs this, with GitHub credentials from the osxkeychain helper or `gh auth login`):
   ```sh
   git push -u origin dev
   ```

## 4. Local dev

1. Create the local secrets file. It is gitignored and must never be committed:
   ```sh
   echo "SESSION_SECRET=$(openssl rand -hex 32)" > backend/.dev.vars
   ```
   This local value does not need to match production.
2. Apply migrations to the local D1 database:
   ```sh
   cd backend && npx wrangler d1 migrations apply noora-db --local && cd ..
   ```
3. Terminal 1, Worker on 127.0.0.1:8787:
   ```sh
   cd backend && npx wrangler dev
   ```
4. Terminal 2, Vite frontend on 127.0.0.1:5173 (proxies `/api` and `/images` to 8787):
   ```sh
   npm run dev -w @beauty-store/frontend
   ```
5. Open http://127.0.0.1:5173 in a browser.

Full list of steps: `setup.txt` section 5.

## 5. Checks

Run these before any deploy. All must pass.

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build -w @beauty-store/frontend
npm run check:bundle -w @beauty-store/frontend
```

- `check:bundle` must report under 150,000 bytes gzip. Last measured: 118,832 bytes.

## 6. Deploy

Deploys go to live production. Run the checks in section 5 first.

Backend Worker:
```sh
cd backend && npx wrangler deploy
```

Frontend (Pages):
```sh
npm run build -w @beauty-store/frontend
cd frontend && npx wrangler pages deploy dist --project-name=noora-studio --branch=main
```

- Deploy the frontend from `frontend/`, not the repo root. Deploying from the root omits `frontend/functions`, which holds the Pages Functions bundle.
- `--branch=main` publishes to production. Without it, the deploy is only a preview.

Verify after deploying:
```sh
curl -s https://noora-studio.pages.dev/api/settings        # expect 200 JSON
curl -sI https://noora-studio.pages.dev/robots.txt          # expect 200, text/plain
curl -s https://noora-api.tridev-g811.workers.dev/api/health # expect {"ok":true}
```

## 7. Live smoke and audits

Smoke checks:
```sh
curl -s https://noora-studio.pages.dev/api/settings
curl -s https://noora-api.tridev-g811.workers.dev/api/health
```

Lighthouse (user-space Chromium, no Homebrew browser casks needed):
```sh
npx playwright install chromium
node -e "console.log(require('playwright').chromium.executablePath())"
```
Copy the printed path into `<chromium-path>` below. The output goes outside the repo:
```sh
CHROME_PATH="<chromium-path>" npx lighthouse https://noora-studio.pages.dev/ --chrome-flags="--headless --no-sandbox" --only-categories=performance,accessibility,seo --output=json --output-path="$HOME/noora-lighthouse-live.json" --quiet
```

Local audit (needs the local dev servers from section 4 running):
```sh
npm run audit:lighthouse
```

## 8. Remaining backlog for the owner

1. Rotate the `/admin` password. This is done by the owner; the password is not in the repo.
2. Review `backend/seed/seed.sql` line 22. It contains a committed PBKDF2 hash for the `admin` user (the value is not reproduced here). Confirm the live admin password has been rotated, then decide whether to remove or replace that hash in the seed file. It stays in git history either way. Not changed in this handoff.
3. In `/admin` -> Settings, set the real WhatsApp number, opening hours, and address. The current values are sample placeholders.
4. Replace the 12 sample products.
5. Decide on the product LCP target. It is waived for now (median about 2.8 s against a 1.8 s target).
6. Check fallback font metrics on a real phone (tuned on Linux only).
7. Google Fonts (Cormorant Garamond, Plus Jakarta Sans) is a third-party dependency. It is not self-hosted.
8. Inter is named in `--bs-font-sans` but never loaded; body text uses the system stack.
9. `npm audit` reports 6 high vulnerabilities. Not addressed yet.
10. The hero tiles are placeholders.
11. Skincare and Makeup nav links both point to `/services` (no per-category anchors).

## 9. Do-not list

- Never commit `.dev.vars`, `.env*`, `admin.txt`, or any secret or token.
- Never paste the admin password or the `SESSION_SECRET` value into files, commits, or chats.
- Never deploy from the repo root. Deploy the frontend from `frontend/` and the backend from `backend/`.
- Never run `wrangler secret put` unless rotating `SESSION_SECRET` on purpose.
- Never use `CLOUDFLARE_API_TOKEN` in files. Login is `npx wrangler login`.
