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
- [x] `WEB-006` Add feed text search (`q`) in API + web controls
- [x] `WEB-007` Add region (`geo_tag`) filter in API + web controls
- [x] `WEB-008` Add trend-shift metric (`trend_delta`) and card indicator

## EPIC-04 Infra + Deploy
- [x] `INF-001` Configure staging + production environments
- [x] `INF-002` Add Cloudflare deployment pipeline
- [x] `INF-003` Add secret management checklist
- [x] `INF-004` Wire DNS for `coasensus.com`
- [x] `INF-005` Validate HTTPS and caching behavior

## EPIC-05 QA + Reliability
- [x] `QA-001` Add ingestion smoke checks
- [x] `QA-002` Add stale-feed detection
- [x] `QA-003` Add API smoke tests
- [x] `QA-004` Add deploy verification checklist
- [x] `QA-005` Define launch gate criteria
- [x] `QA-006` Add explicit monitor alerts for stale feed and semantic failure streaks
- [x] `QA-007` Add per-session analytics rate limiting and sampling on web client
- [x] `QA-008` Add region/category taxonomy distribution to admin feed diagnostics
- [x] `QA-009` Add cached feed query path for burst traffic on `/api/feed`
- [x] `QA-010` Add automated 24h launch-stability readiness checker for monitor workflows
- [x] `QA-011` Add top-N category dominance diagnostics + monitor alert signal

## EPIC-06 Hybrid Semantic Layer (Execution Plan V2)
- [x] `SEM-001` Add phase-1 bouncer prefilter (query + local gates)
- [x] `SEM-002` Add D1 semantic cache table and migration
- [x] `SEM-003` Integrate semantic enrichment in refresh pipeline (cache + heuristic + optional LLM path)
- [x] `SEM-004` Extend categories across API/filter/UI/shared contracts (`tech_ai`, `sports`, `entertainment`)
- [x] `SEM-005` Add `services/llm-editor` scaffold with schema/editor tests
- [x] `SEM-006` Enable LLM in staging and compare heuristic vs LLM output quality
- [x] `SEM-007` Implement final front-page ranking formula in API ordering path
- [x] `SEM-008` Add semantic quality telemetry dashboard/report

## EPIC-07 Post-Launch Tuning
- [x] `TUNE-001` Prioritize LLM candidate selection and add category-specific sports/entertainment semantic thresholds
- [x] `TUNE-002` Validate tuning impact on staging after a full refresh cycle
- [x] `TUNE-003` Roll out semantic tuning pass #1 to production and verify monitor + feed composition
- [x] `TUNE-004` Add topic/event de-dup pass (staging verified)

## Suggested assignment
- Agent 1: EPIC-00
- Agent 2: EPIC-01
- Agent 3: EPIC-02
- Agent 4: EPIC-03
- Agent 5: EPIC-04
- Agent 6: EPIC-05
