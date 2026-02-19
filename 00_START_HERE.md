# Start Here (Noob-Friendly)

## What is already done
1. A full execution strategy exists in `COASENSUS_EXECUTION_PLAN.md`.
2. A monorepo skeleton is ready for multi-agent work.
3. Shared market data contracts are scaffolded.
4. Agent workflow docs and commit policy are written.
5. Live Polymarket fetch client and local smoke test are available.
6. Fresh-session checkpoint doc exists at `docs/HANDOFF.md`.

## What you do first
1. Open a terminal in this folder:
   - `E:\Coasensus Predictive future`
2. Run:
   - `npm install`
3. Validate workspace:
   - `npm run check`
4. Run live ingestion smoke test:
   - `npm run smoke:ingest`
5. Optional tuning for smoke run:
   - `POLYMARKET_LIMIT_PER_PAGE=100 POLYMARKET_MAX_PAGES=3 npm run smoke:ingest`
6. Check persisted output files:
   - `infra/db/local/latest/snapshot.json`
   - `infra/db/local/latest/raw.json`
   - `infra/db/local/latest/normalized.json`
7. Start local feed API:
   - `npm run dev:feed-api`
8. Open in browser:
   - `http://localhost:8787/health`
   - `http://localhost:8787/feed?page=1&pageSize=20&sort=score`
9. Start local web app in a second terminal:
   - `npm run dev:web`
10. Open:
   - `http://localhost:3000`
11. Optional: use SQLite as feed source:
   - `set FEED_STORAGE_MODE=sqlite`
   - `npm run dev:feed-api`

## How to run multiple Codex agents
1. Read `docs/ORCHESTRATION_PLAYBOOK.md`.
2. For each agent, open a new terminal tab.
3. In each terminal, run:
   - `git checkout main`
   - `git pull` (once remote is connected)
   - `git checkout -b agent/<workstream-name>`
4. Use prompts from `docs/AGENT_PROMPTS.md`.
5. Merge in the order from `docs/AGENT_BOARD.md`.

## If you want me to keep driving
1. I can set up the actual `apps/web` Next.js app.
2. I can add DB persistence for fetched and normalized markets.
3. I can scaffold filter engine with tests.
4. I can prepare Cloudflare deployment config next.
