# Progress Log

## 2026-02-19
1. Added execution strategy in `COASENSUS_EXECUTION_PLAN.md`.
2. Initialized monorepo folder layout.
3. Added beginner runbook and orchestration docs.
4. Added shared market type contracts.
5. Added agent prompts and commit policy.
6. Added execution issue checklist for parallel agents.
7. Added real foundation tooling: ESLint + Vitest + strict workspace typecheck.
8. Added ingest normalizer module with tests.
9. Added filter engine module with deterministic curation + tests.
10. Added live Polymarket API client with pagination, timeout, retries, and backoff.
11. Added ingestion run helper (`runIngestionOnce`) and local smoke script.
12. Validated live smoke run against Polymarket (`rawCount: 100`, `normalizedCount: 100`).
13. Added local persistence for raw + normalized + snapshot artifacts under `infra/db/local`.
14. Added local curated feed API (`/feed`) backed by latest persisted normalized data.
15. Added local web feed UI with responsive cards wired to `/feed`.
16. Added cross-origin support in feed API for local multi-port development.
17. Added SQLite persistence module for ingestion runs (`infra/db/coasensus.sqlite` default).
18. Added dual persistence mode in ingest flow (JSON + SQLite).
19. Added structured ingest smoke logs with timing metrics.
20. Added feed API storage mode switch (`json` or `sqlite`).
21. Added basic web analytics events + API ingestion (`POST /analytics`).
22. Added Cloudflare API Worker scaffold with D1-backed `/api/feed` + `/api/analytics` routes.
23. Added Cloudflare config files for staging/production (`wrangler.api.jsonc`, `wrangler.pages.jsonc`).
24. Added baseline D1 SQL migration at `infra/db/migrations/0001_initial_schema.sql`.
25. Added GitHub Actions Cloudflare deploy workflow (`deploy-cloudflare.yml`).
26. Added noob-friendly Cloudflare setup + secrets runbooks.
27. Updated Cloudflare API config with real D1 IDs for staging and production.
28. Applied staging D1 migration (`0001_initial_schema.sql`) remotely.
29. Deployed staging API Worker (`coasensus-api-staging`) with route `staging.coasensus.com/api/*`.
30. Created Cloudflare Pages project (`coasensus-web`) and deployed staging preview branch.
31. Applied production D1 migration (`0001_initial_schema.sql`) remotely.
32. Deployed production API Worker (`coasensus-api`) with route `coasensus.com/api/*`.
33. Deployed production Pages branch (`main`) to `coasensus-web.pages.dev`.
34. Attached Pages custom domains (`coasensus.com`, `staging.coasensus.com`) via Cloudflare API.
35. Captured DNS blocker: custom domains remain `pending` with `CNAME record not set`.
36. Added Pages preview API fallback in web app for `*.coasensus-web.pages.dev`.
37. Redeployed staging Pages branch with fallback update (`d4db533e`).
38. Redeployed production Pages branch with fallback update (`73b297ed`).
39. Confirmed API health checks return 200 on:
   - `https://coasensus.com/api/health`
   - `https://coasensus-api-staging.tahmidahmad1970.workers.dev/api/health`
40. Added deploy workflow DNS upsert automation and fixed push-event execution issues.
41. DNS CNAME validation moved from `pending` to `active` for:
   - `coasensus.com`
   - `staging.coasensus.com`
42. Verified custom-domain web + API health:
   - `https://coasensus.com` => `200`
   - `https://staging.coasensus.com` => `200`
   - `https://coasensus.com/api/health` => `200`
   - `https://staging.coasensus.com/api/health` => `200`
43. Diagnosed recurring CI deploy failure: worker step was using invalid Wrangler flag (`--log-level`) and exiting with help text.
44. Added temporary annotation-based diagnostics, removed invalid flag, and confirmed `Deploy Cloudflare` workflow is now green.
45. Added CI-specific Worker config (`wrangler.api.ci.jsonc`) to avoid route-management friction in automated deploy runs.
46. Added Cloudflare-side Polymarket refresh pipeline in Worker (`refresh.ts`) and wired `/api/admin/refresh-feed`.
47. Added automatic feed bootstrap on empty `curated_feed` and scheduled refresh handlers via cron triggers.
48. Diagnosed and fixed D1 runtime issues in refresh path:
   - removed problematic `AbortController` timeout flow in Worker runtime
   - switched snapshot persistence to chunked `db.batch()` writes
49. Hardened admin refresh route with `COASENSUS_ADMIN_REFRESH_TOKEN` support (`X-Admin-Token` / Bearer / query token).
50. Set `COASENSUS_ADMIN_REFRESH_TOKEN` secrets for staging + production Workers.
51. Improved curation quality:
   - boundary-aware keyword matching (no raw substring matching)
   - removed ambiguous `who` public-health keyword causing false positives
   - added sports/entertainment exclusion tokens
   - raised newsworthiness strictness (`newsworthinessThreshold=2`)
52. Verified live refresh + feed population on both environments after tuning:
   - production counts: total `800`, curated `214`, rejected `586`
   - staging counts: total `800`, curated `214`, rejected `586`
53. Rotated `COASENSUS_ADMIN_REFRESH_TOKEN` on staging + production and verified:
   - no token => `401`
   - old token => `401`
   - new token => `200`
54. Added algorithm documentation for non-technical and technical readers:
   - `docs/FILTER_ALGORITHM.md`
   - linked from root `README.md`
55. Started execution of `docs/EXECUTION_PLAN_V2.md` on branch `feat/execution-plan-v2`.
56. Implemented Phase-1 pre-filter "Bouncer" controls in Cloudflare refresh pipeline:
   - server-side Polymarket query filters (`volume_num_min`, `liquidity_num_min`, `start_date_min`, `end_date_min`)
   - local fallback bouncer checks on volume, liquidity, min hours to end, and max market age
   - new env controls in Wrangler config:
     - `COASENSUS_BOUNCER_MIN_VOLUME`
     - `COASENSUS_BOUNCER_MIN_LIQUIDITY`
     - `COASENSUS_BOUNCER_MIN_HOURS_TO_END`
     - `COASENSUS_BOUNCER_MAX_MARKET_AGE_DAYS`
57. Added `bouncerDroppedCount` to refresh summary for observability.
58. Deployed staging with bouncer-enabled refresh and verified successful ingest response.
59. Implemented Phase-2 semantic enrichment pipeline in Cloudflare refresh flow:
   - D1-backed semantic cache reads/writes (`semantic_market_cache`)
   - cache fingerprinting by prompt version + market content
   - heuristic classification fallback for uncached markets
   - optional LLM classification path (env-gated, OpenAI-compatible API)
60. Added D1 migration `0002_semantic_cache.sql` and updated migration docs.
61. Extended category surface across stack with:
   - `tech_ai`
   - `sports`
   - `entertainment`
62. Added workspace package `services/llm-editor` (schema, prompt/editor helpers, cache-aware enrichment helpers, unit tests).
63. Added/updated Worker config + docs for semantic controls:
   - `COASENSUS_LLM_ENABLED`
   - `COASENSUS_LLM_MODEL`
   - `COASENSUS_LLM_BASE_URL`
   - `COASENSUS_LLM_PROMPT_VERSION`
   - `COASENSUS_LLM_MIN_NEWS_SCORE`
   - `COASENSUS_LLM_MAX_MARKETS_PER_RUN`
   - secret: `COASENSUS_LLM_API_KEY`
64. Verified local Worker smoke refresh after migration:
   - refresh summary includes `semantic` metrics (`cacheHits`, `cacheMisses`, `llmEvaluated`, `heuristicEvaluated`)
   - feed includes semantic decision reasons (example: `included_semantic_threshold_met`)
65. Ran full monorepo validation successfully: `npm run check` (typecheck + lint + tests).
66. Committed and pushed Phase-2 implementation to `feat/execution-plan-v2`:
   - commit: `bcda054`
   - message: `feat: add semantic cache enrichment and llm editor scaffold`
67. Implemented `SEM-007` front-page ranking formula in Worker refresh/API path:
   - `Front Page Score = (w1 * S_LLM) + (w2 * log(V+1)) + (w3 * log(L+1)) - (lambda * delta_t)`
   - `S_LLM = newsworthinessScore / 100`
   - `delta_t = hours since updatedAt (fallback: createdAt)`
68. Added configurable ranking vars in Cloudflare config:
   - `COASENSUS_FRONTPAGE_W1`
   - `COASENSUS_FRONTPAGE_W2`
   - `COASENSUS_FRONTPAGE_W3`
   - `COASENSUS_FRONTPAGE_LAMBDA`
69. Added D1 migration `0003_front_page_score.sql`:
   - adds `curated_feed.front_page_score`
   - adds index `idx_curated_feed_front_page_score`
70. Updated feed API `sort=score` ordering to use `front_page_score` when available, with automatic fallback to legacy ordering if migration is not yet applied.
71. Added API response metadata/field for observability:
   - `meta.scoreFormula` (`front_page_score_v1` or legacy)
   - item field `frontPageScore`
72. Updated algorithm and infra docs to reflect formula-driven ranking and new env controls.
73. Verified locally after applying migration `0003`:
   - manual refresh returned `200`
   - `/api/feed?sort=score` returned `scoreFormula: front_page_score_v1`
   - ranked items included populated `frontPageScore` values.
74. Applied migration `0003_front_page_score.sql` to remote staging D1 and deployed updated staging Worker (version `335900ab-c578-46e2-af4d-fc14a69d3e12`).
75. Verified staging API now reports formula mode:
   - `meta.scoreFormula = front_page_score_v1`
   - `frontPageScore` currently `0` on existing rows until next refresh run updates snapshot scores.
76. Triggered authenticated staging refresh and verified non-zero persisted ranking values:
   - refresh run id: `2026-02-20T13-23-20-355Z`
   - `frontPageScore` now populated in top feed rows.
77. Added provider abstraction for semantic LLM classification (`openai` + `gemini`) in Worker refresh pipeline.
78. Added configurable provider env (`COASENSUS_LLM_PROVIDER`) and Gemini defaults/docs:
   - provider: `gemini`
   - model: `gemini-2.5-flash`
   - base URL: `https://generativelanguage.googleapis.com/v1beta`
79. Ran full workspace validation successfully after provider changes (`npm run check`).
80. Enabled Gemini provider in staging environment config:
   - `COASENSUS_LLM_ENABLED=1`
   - `COASENSUS_LLM_PROVIDER=gemini`
   - `COASENSUS_LLM_MODEL=gemini-2.5-flash`
   - `COASENSUS_LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta`
81. Deployed staging Worker with Gemini settings (version `2b26deea-a05e-42ac-8012-70c14a6ad973`) and executed authenticated refresh.
82. Initial Gemini run metrics (prompt `v1-gemini-001`) showed provider quota/rate-limit behavior:
   - `llmEvaluated=8`
   - `llmFailures=792`
   - `heuristicEvaluated=792`
83. Tuned staging cap for stable operation:
   - `COASENSUS_LLM_MAX_MARKETS_PER_RUN=8`
   - prompt version bumped to `v1-gemini-002`
84. Redeployed staging Worker (version `c15a274d-bf96-4e24-ae36-96983ebca18c`) and verified clean refresh:
   - `llmEvaluated=8`
   - `llmFailures=0`
   - `heuristicEvaluated=792`
   - total runtime reduced to ~22s
85. Completed SEM-006 comparison snapshot (staging):
   - Baseline (heuristic-only): `269 curated / 531 rejected`
   - Gemini-mixed run (8 LLM + 792 heuristic): `269 curated / 531 rejected`
   - Cache model distribution for prompt `v1-gemini-002`: `8 gemini-2.5-flash`, `792 heuristic-v1`
86. Verified live staging feed remains healthy after Gemini enablement:
   - `scoreFormula=front_page_score_v1`
   - feed returns non-zero `frontPageScore` values.
