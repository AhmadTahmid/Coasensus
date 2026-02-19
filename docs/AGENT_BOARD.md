# Agent Board

## Merge order
1. Platform foundation
2. Ingestion + filter integration branch
3. Web UI/API integration
4. Infra/deploy
5. QA/observability hardening

## Workstreams

### Agent 1: Platform
- Branch: `agent/platform-foundation`
- Scope:
  - workspace config
  - CI baseline
  - shared types
- Exit criteria:
  - `npm run typecheck` passes
  - CI workflow runs

### Agent 2: Ingestion
- Branch: `agent/ingest-pipeline`
- Scope:
  - active market ingestion
  - normalization
  - retries/backoff
- Exit criteria:
  - can fetch active markets
  - writes normalized output

### Agent 3: Filter
- Branch: `agent/filter-engine`
- Scope:
  - exclusion rules
  - civic/news scoring
  - decision reasons
- Exit criteria:
  - unit tests on curated fixtures
  - explainable keep/drop decisions

### Agent 4: Web
- Branch: `agent/web-feed-ui`
- Scope:
  - feed cards
  - API integration
  - sort/filter controls
- Exit criteria:
  - mobile + desktop responsive
  - loading/error states

### Agent 5: Infra
- Branch: `agent/infra-deploy`
- Scope:
  - cloud deploy pipeline
  - domain + SSL setup
  - environment secrets
- Exit criteria:
  - public staging url
  - production ready dns checklist

### Agent 6: QA
- Branch: `agent/qa-observability`
- Scope:
  - smoke tests
  - stale-data alerts
  - ingestion health checks
- Exit criteria:
  - monitoring catches failures fast

