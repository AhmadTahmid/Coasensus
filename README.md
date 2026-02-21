# Coasensus

Coasensus is a curated predictive-news feed built from active Polymarket markets.  
The goal is to keep civic-impact and newsworthy markets while removing meme/noise markets.

## Repo status
- This is the initial orchestration scaffold.
- Main execution plan: `COASENSUS_EXECUTION_PLAN.md`
- Beginner runbook: `00_START_HERE.md`
- Agent orchestration guide: `docs/ORCHESTRATION_PLAYBOOK.md`
- Filter algorithm explainer: `docs/FILTER_ALGORITHM.md`
- Deploy verification runbook: `docs/DEPLOY_VERIFICATION_CHECKLIST.md`
- Launch gate criteria: `docs/LAUNCH_GATES.md`
- Fresh-session checkpoint: `docs/HANDOFF.md`
- Foundation checks now run with:
  - TypeScript typecheck
  - ESLint lint
  - Vitest unit tests (ingest + filter services)
- Ingestion persistence supports:
  - JSON snapshots in `infra/db/local`
  - SQLite DB in `infra/db/coasensus.sqlite`
- Cloudflare deployment scaffolding now includes:
  - API Worker config + source in `infra/cloudflare`
  - Pages deploy config
  - D1 migration baseline in `infra/db/migrations`
  - GitHub Actions deploy workflow in `.github/workflows/deploy-cloudflare.yml`

## Monorepo layout
```text
apps/web                # frontend feed/cards UI
services/ingest-worker  # market ingestion jobs
services/filter-engine  # filtering and scoring logic
services/llm-editor     # semantic classifier + cache-aware enrichment
packages/shared-types   # shared TypeScript contracts
infra/cloudflare        # deployment setup
infra/db                # database schema and migrations
docs/                   # planning, runbooks, decisions
```

## Useful commands
```bash
npm install
npm run check
npm run smoke:ingest
npm run dev:feed-api
npm run dev:web
npm run monitor:prod
```

## Admin diagnostics
- Feed UI: `https://coasensus.com`
- Read-only diagnostics dashboard: `https://coasensus.com/admin.html`
- Dashboard uses existing admin endpoints and requires an admin token for protected diagnostics routes.
