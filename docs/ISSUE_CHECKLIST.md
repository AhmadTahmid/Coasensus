# Issue Checklist (Execution Board)

## EPIC-00 Foundation
- [x] `PLAT-001` Initialize strict TS monorepo tooling
- [x] `PLAT-002` Add lint + format + test baseline
- [x] `PLAT-003` Stabilize shared contracts in `packages/shared-types`
- [x] `PLAT-004` Add CI checks for typecheck/lint/test

## EPIC-01 Polymarket Ingestion
- [x] `ING-001` Build active market API client adapter
- [x] `ING-002` Add normalization mapper -> canonical `Market`
- [x] `ING-003` Persist raw payloads + normalized records
- [x] `ING-004` Add retries, timeout, and backoff policy
- [x] `ING-005` Add ingestion metrics and success/failure logs

## EPIC-02 Curation Engine
- [x] `FLT-001` Add hard exclusion rules for meme/noise categories
- [x] `FLT-002` Add civic relevance scoring rules
- [x] `FLT-003` Add newsworthiness scoring rules
- [x] `FLT-004` Generate explainable `decisionReason` output
- [x] `FLT-005` Add curated fixtures and unit tests

## EPIC-03 API + Feed UI
- [x] `WEB-001` Create curated feed API with pagination
- [x] `WEB-002` Build feed/card page with responsive layout
- [x] `WEB-003` Add category badges and sorting controls
- [x] `WEB-004` Add empty/loading/error states
- [x] `WEB-005` Add basic analytics events

## EPIC-04 Infra + Deploy
- [x] `INF-001` Configure staging + production environments
- [x] `INF-002` Add Cloudflare deployment pipeline
- [x] `INF-003` Add secret management checklist
- [ ] `INF-004` Wire DNS for `coasensus.com`
- [ ] `INF-005` Validate HTTPS and caching behavior

## EPIC-05 QA + Reliability
- [x] `QA-001` Add ingestion smoke checks
- [ ] `QA-002` Add stale-feed detection
- [ ] `QA-003` Add API smoke tests
- [ ] `QA-004` Add deploy verification checklist
- [ ] `QA-005` Define launch gate criteria

## Suggested assignment
- Agent 1: EPIC-00
- Agent 2: EPIC-01
- Agent 3: EPIC-02
- Agent 4: EPIC-03
- Agent 5: EPIC-04
- Agent 6: EPIC-05
