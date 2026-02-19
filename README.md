# Coasensus

Coasensus is a curated predictive-news feed built from active Polymarket markets.  
The goal is to keep civic-impact and newsworthy markets while removing meme/noise markets.

## Repo status
- This is the initial orchestration scaffold.
- Main execution plan: `COASENSUS_EXECUTION_PLAN.md`
- Beginner runbook: `00_START_HERE.md`
- Agent orchestration guide: `docs/ORCHESTRATION_PLAYBOOK.md`
- Fresh-session checkpoint: `docs/HANDOFF.md`
- Foundation checks now run with:
  - TypeScript typecheck
  - ESLint lint
  - Vitest unit tests (ingest + filter services)
- Ingestion persistence supports:
  - JSON snapshots in `infra/db/local`
  - SQLite DB in `infra/db/coasensus.sqlite`

## Monorepo layout
```text
apps/web                # frontend feed/cards UI
services/ingest-worker  # market ingestion jobs
services/filter-engine  # filtering and scoring logic
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
```
