# Issue Checklist (Execution Board)

## EPIC-00 Foundation
- [ ] `PLAT-001` Initialize strict TS monorepo tooling
- [ ] `PLAT-002` Add lint + format + test baseline
- [ ] `PLAT-003` Stabilize shared contracts in `packages/shared-types`
- [ ] `PLAT-004` Add CI checks for typecheck/lint/test

## EPIC-01 Polymarket Ingestion
- [ ] `ING-001` Build active market API client adapter
- [ ] `ING-002` Add normalization mapper -> canonical `Market`
- [ ] `ING-003` Persist raw payloads + normalized records
- [ ] `ING-004` Add retries, timeout, and backoff policy
- [ ] `ING-005` Add ingestion metrics and success/failure logs

## EPIC-02 Curation Engine
- [ ] `FLT-001` Add hard exclusion rules for meme/noise categories
- [ ] `FLT-002` Add civic relevance scoring rules
- [ ] `FLT-003` Add newsworthiness scoring rules
- [ ] `FLT-004` Generate explainable `decisionReason` output
- [ ] `FLT-005` Add curated fixtures and unit tests

## EPIC-03 API + Feed UI
- [ ] `WEB-001` Create curated feed API with pagination
- [ ] `WEB-002` Build feed/card page with responsive layout
- [ ] `WEB-003` Add category badges and sorting controls
- [ ] `WEB-004` Add empty/loading/error states
- [ ] `WEB-005` Add basic analytics events

## EPIC-04 Infra + Deploy
- [ ] `INF-001` Configure staging + production environments
- [ ] `INF-002` Add Cloudflare deployment pipeline
- [ ] `INF-003` Add secret management checklist
- [ ] `INF-004` Wire DNS for `coasensus.com`
- [ ] `INF-005` Validate HTTPS and caching behavior

## EPIC-05 QA + Reliability
- [ ] `QA-001` Add ingestion smoke checks
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

