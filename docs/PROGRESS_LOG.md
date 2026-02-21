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
87. Added semantic telemetry persistence migration `0004_semantic_refresh_runs.sql` and wired refresh-run metric writes in Worker.
88. Added admin-protected telemetry endpoint:
   - `GET /api/admin/semantic-metrics?limit=30`
   - returns recent run metrics + aggregated prompt/provider/model stats.
89. Applied migration `0004_semantic_refresh_runs.sql` to remote staging D1 and deployed telemetry-enabled Worker (`5dbed2f8-2e3f-4811-9e6c-e7788de1e393`).
90. Detected and fixed LLM cap bug:
   - previous logic capped successful LLM calls, not attempts, causing excessive retries on provider failures
   - added `llmAttempts` metric and now cap is enforced on attempts (`COASENSUS_LLM_MAX_MARKETS_PER_RUN`).
91. Re-ran staging cap tests after fix (forced cache misses via prompt-version bumps):
   - `v1-gemini-ramp-8fix`: attempts `8`, success `1`, failures `7`, runtime ~`11.8s`
   - `v1-gemini-ramp-16fix`: attempts `16`, success `0`, failures `16`, runtime ~`12.4s`
   - `v1-gemini-ramp-32fix`: attempts `32`, success `0`, failures `32`, runtime ~`16.3s`
92. Restored staging to stable Gemini profile and redeployed (`353018fd-7e32-4814-8dc3-d2f3036682d5`):
   - provider `gemini`
   - model `gemini-2.5-flash`
   - prompt `v1-gemini-002`
   - cap `COASENSUS_LLM_MAX_MARKETS_PER_RUN=8`
93. Verified latest staging refresh and telemetry endpoint:
   - latest run reports `llmAttempts` and correct success-rate math
   - feed remains healthy with `scoreFormula=front_page_score_v1`.
94. Added richer LLM HTTP error surfacing in Worker:
   - OpenAI/Gemini non-2xx responses now include response-body detail in thrown errors
   - refresh summary now includes `semantic.llmErrorSamples` (up to 5 samples).
95. Re-ran staging Gemini test after user enabled billing with forced fresh prompt version:
   - staging prompt set to `v1-gemini-003-billing`
   - refresh metrics: `llmAttempts=8`, `llmEvaluated=8`, `llmFailures=0`, `llmSuccessRate=1.0`
96. Confirmed semantic telemetry endpoint reflects improved post-billing success:
   - `GET /api/admin/semantic-metrics` latest run and aggregate show Gemini success rate `1.0`.
97. Rolled production to Gemini profile and telemetry stack:
   - applied D1 migrations `0002`, `0003`, `0004` to production
   - deployed production Worker with Gemini env (`v1-gemini-003-billing`, cap `8`)
   - deployment version: `b3ca4ccf-17ff-454c-abc3-9f33ff6d95fc`
98. Added production admin refresh access by setting `COASENSUS_ADMIN_REFRESH_TOKEN` secret to current token for verification workflow.
99. Verified production endpoints after deploy:
   - `POST /api/admin/refresh-feed` => `200`
   - `GET /api/admin/semantic-metrics` => `200`
   - `GET /api/feed?sort=score` healthy (`front_page_score_v1`, non-zero scores)
100. Production Gemini activation blocker identified:
   - `wrangler secret list --env production` shows only `COASENSUS_ADMIN_REFRESH_TOKEN`
   - missing `COASENSUS_LLM_API_KEY` in production means `llmEnabled=false` at runtime and classification falls back to heuristic.
101. User added production `COASENSUS_LLM_API_KEY`; reran production validation with forced fresh prompt version:
   - production prompt set to `v1-gemini-004-prodcheck`
   - refresh metrics: `llmAttempts=8`, `llmEvaluated=8`, `llmFailures=0`, `heuristicEvaluated=792`
   - telemetry confirms Gemini success rate `1.0`
102. Production semantic + feed health confirmed:
   - `GET /api/admin/semantic-metrics` => `200` with Gemini success data
   - `GET /api/feed?sort=score` => healthy (`front_page_score_v1`, non-zero scores)
103. Added production error observability path for future provider issues:
   - `llmErrorSamples` now exposed in refresh summary (empty on successful run).
104. Merged `feat/execution-plan-v2` into `main` and pushed merged branch to origin (`51fb526`).
105. Completed post-merge production smoke checks:
   - `GET /api/health` => `200`
   - `GET /api/feed?sort=score` => `200`
   - `GET /api/admin/semantic-metrics` without token => `401` (auth path verified)
106. Added automated production freshness/health monitor:
   - script: `scripts/monitor-production.mjs`
   - workflow: `.github/workflows/monitor-production.yml` (cron every 15 min + manual dispatch)
   - checks health, non-empty feed, and telemetry recency threshold (`COASENSUS_MAX_STALE_MINUTES`)
107. Added monitor workflow secret requirement to runbook:
   - GitHub secret `COASENSUS_ADMIN_REFRESH_TOKEN` should match Worker admin token.
108. Completed `QA-004` deploy verification documentation:
   - added `docs/DEPLOY_VERIFICATION_CHECKLIST.md` with post-deploy smoke, freshness, and rollback triggers.
109. Completed `QA-005` launch gate definition:
   - added `docs/LAUNCH_GATES.md` with P0/P1 go-no-go criteria and operational alert thresholds.
110. Linked reliability runbooks in root docs:
   - updated `README.md` with deploy verification + launch gate references
   - added `npm run monitor:prod` command reference.
111. Updated execution board status:
   - marked `QA-004` and `QA-005` done in `docs/ISSUE_CHECKLIST.md`.
112. Fixed CI/deploy pipeline install failure on `main`:
   - root cause: `package-lock.json` missing `@coasensus/llm-editor` workspace entry, causing `npm ci` to fail.
   - fix: regenerated lockfile with `npm install --package-lock-only`.
113. Local validation after lockfile fix:
   - `npm ci` => success
   - `npm run check` => success (typecheck, lint, tests across workspaces).
114. Hardened CI test diagnostics in `.github/workflows/ci.yml`:
   - replaced monolithic `npm run test` step with per-workspace test steps for clearer failure attribution.
115. Validated updated CI test commands on Linux Node 22 container:
   - ran `npm ci` and each workspace test command from CI script
   - all commands passed in `node:22-bullseye`.
116. Stabilized CI for `ingest-worker` suite:
   - updated CI step to run `services/ingest-worker` tests with `--pool=forks --maxWorkers=1 --minWorkers=1`.
117. Verified ingest-worker stability command on Linux Node 22 container:
   - command passed with all 13 ingest-worker tests green.
118. Root cause found for CI ingest-worker failures:
   - `services/ingest-worker/src/feed-store.ts` imports `@coasensus/filter-engine`
   - CI test path did not build `filter-engine` first, so Vite could not resolve package entry (`dist/index.js` missing).
119. CI fix applied:
   - added `Build filter-engine dependency` step before test steps in `.github/workflows/ci.yml`.
120. Revalidated complete CI command chain in Linux Node 22 container after cleanup of `dist/` folders:
   - typecheck + lint + filter-engine build + all workspace tests passed.
121. First scheduled production monitor run succeeded:
   - workflow run: `22230889095`
   - secret validation step passed and production monitor check passed.
122. Post-fix Actions status on `main` is green:
   - CI run `22230993533` => success
   - Deploy Cloudflare run `22230993568` => success.
123. Executed a parallel-agent sprint (3 concurrent worker lanes) with strict file ownership to accelerate milestone delivery.
124. Backend diagnostics lane complete:
   - added admin endpoint `GET /api/admin/feed-diagnostics` (token-protected)
   - returns feed counts, category split, top decision reasons, and top reason codes from `curated_feed`.
125. Web feed UX lane complete:
   - upgraded `apps/web/public` to newspaper-style card hierarchy
   - added front-page lead card treatment and explicit frontPageScore rendering with fallback to legacy score.
126. Ops monitoring lane complete:
   - enhanced `scripts/monitor-production.mjs` output (`ok: true` on success + richer failure context)
   - added staging monitor workflow `.github/workflows/monitor-staging.yml` (cron every 30 minutes + manual dispatch).
127. Validation after integration:
   - `npm run check` => success
   - `node --check apps/web/public/app.js` => success
   - `node --check scripts/monitor-production.mjs` => success
   - parsed monitor workflows with `js-yaml` => valid YAML.
128. Post-push pipeline status for parallel sprint commit (`a50278c`):
   - CI run `22232425671` => success
   - Deploy Cloudflare run `22232425669` => success.
129. Manual dispatch validation for new staging monitor:
   - run `22232501844` executed and failed at telemetry auth (`401 Unauthorized`) on `/api/admin/semantic-metrics`
   - indicates GitHub secret token does not currently match staging Worker `COASENSUS_ADMIN_REFRESH_TOKEN` value.
130. Identified deploy-config drift affecting semantic behavior:
   - `infra/cloudflare/wrangler.api.ci.jsonc` contained only minimal vars for staging/production.
   - CI Worker deploys were therefore running with default runtime values in code (not intended Gemini semantic profile).
131. Fixed CI deploy config drift:
   - synced `infra/cloudflare/wrangler.api.ci.jsonc` env vars with semantic/bouncer/front-page settings from `wrangler.api.jsonc`
   - includes LLM provider/model/prompt/min-news-score/max-per-run and front-page ranking weights.
132. Local validation for config fix:
   - `wrangler.api.ci.jsonc` parses as valid JSON.
133. Merged CI config fix to `main` and pushed (`530e567`), triggering fresh CI + deploy pipeline.
134. Post-merge pipeline status:
   - CI run `22234911583` => success
   - Deploy Cloudflare run `22234911551` => success
135. Verified semantic runtime profile after next production refresh window:
   - manual monitor run `22235285311` => success
   - latest production semantic telemetry snapshot (`fetchedAt 2026-02-20T18:00:44.996Z`) now reports:
     - `llmEnabled: true`
     - `llmProvider: gemini`
     - `llmModel: gemini-2.5-flash`
     - `llmEvaluated: 8`
     - `llmFailures: 0`
136. Staging profile remains healthy and aligned:
   - monitor run `22234968743` => success
   - latest staging telemetry shows `llmEnabled: true`, provider `gemini`, model `gemini-2.5-flash`.
137. Semantic tuning pass #1 implementation (branch `agent/semantic-tuning-pass1`):
   - added LLM candidate prioritization for cache misses so capped LLM attempts are spent on higher-signal markets first (volume/liquidity/recency/category hints)
   - strict meme-token candidates are now short-circuited to heuristic classification and do not consume LLM attempt budget
   - added category-specific news floors:
     - `COASENSUS_LLM_MIN_NEWS_SCORE_SPORTS` (default `72`)
     - `COASENSUS_LLM_MIN_NEWS_SCORE_ENTERTAINMENT` (default `78`)
   - curation now emits more specific rejection reasons for civic/news threshold misses.
138. Semantic tuning config/docs sync:
   - updated `infra/cloudflare/wrangler.api.jsonc` + `infra/cloudflare/wrangler.api.ci.jsonc` with new category-threshold vars across root/staging/production
   - updated `docs/FILTER_ALGORITHM.md` with new gating behavior and LLM-budget prioritization logic.
139. Validation for semantic tuning pass #1:
   - `npm run check` => success
   - `npx wrangler deploy --dry-run --config infra/cloudflare/wrangler.api.ci.jsonc --env staging` => success.
140. Staging deploy for semantic tuning pass #1:
   - deployed `coasensus-api-staging` with version `4ea11048-538b-4c2f-b710-ecc2238b8174`
   - endpoint checks:
     - `GET /api/health` => `200`
     - `GET /api/feed?page=1&pageSize=5&sort=score` => `200`
     - `GET /api/admin/semantic-metrics?limit=1` without token => `401` (expected).
141. Post-deploy monitor status:
   - monitor staging run `22235817443` => success
   - monitor production run `22235817423` => success
   - latest staging telemetry snapshot still points to pre-deploy refresh (`fetchedAt 2026-02-20T18:00:25.942Z`), so tuning impact verification requires next staging refresh cycle.
142. Post-refresh verification for semantic tuning pass #1 (staging):
   - monitor staging run `22236290635` => success
   - latest telemetry snapshot now reflects post-deploy run (`runId 2026-02-20T18-30-16-036Z`, `fetchedAt 2026-02-20T18:30:16.036Z`)
   - semantic telemetry remained healthy:
     - `llmEnabled: true`
     - `llmAttempts: 1`
     - `llmEvaluated: 1`
     - `llmFailures: 0`
143. Feed composition impact after tuning (staging):
   - curated total dropped from `273` to `218` after refresh
   - top 20 feed categories became fully civic (`politics: 20`)
   - category distribution (curated set):
     - `politics: 190`
     - `economy: 13`
     - `geopolitics: 8`
     - `tech_ai: 6`
     - `sports: 1`
     - `entertainment: 0`
   - sports gating confirmed: `207` sports markets total, `206` rejected (mostly `excluded_semantic_news_threshold_sports`), `1` curated with news score `75`.
144. Promoted semantic tuning pass #1 to `main`:
   - merged branch `agent/semantic-tuning-pass1` as commit `4967a40`
   - CI run `22236383073` => success
   - Deploy Cloudflare run `22236383061` => success.
145. Production post-deploy verification:
   - monitor production run `22236791485` => success
   - latest production refresh snapshot: `runId 2026-02-20T18-45-14-219Z` (`fetchedAt 2026-02-20T18:45:14.219Z`)
   - telemetry healthy (`llmEnabled=true`, `llmFailures=0`).
146. Production feed composition after semantic tuning pass #1:
   - curated total reduced from `270` to `214`
   - top 20 categories are fully politics/civic (`politics: 20`)
   - curated category mix:
     - `politics: 190`
     - `economy: 13`
     - `geopolitics: 8`
     - `tech_ai: 3`
     - `sports: 0`
     - `entertainment: 0`
   - sports/entertainment suppression confirmed in production:
     - `sports`: `206` total, `0` curated
     - `entertainment`: `96` total, `0` curated.
147. Started next milestone: topic/event de-dup lane (`agent/topic-dedup-pass1`).
   - Added diversity pass in Worker curation pipeline (`applyTopicDeduplication`) to demote near-duplicate story variants after score ordering.
   - Duplicate demotions use explicit reasons:
     - `excluded_topic_duplicate_of_<anchor_market_id>`
     - reason code suffix `duplicate_of_<anchor_market_id>`.
148. Added configurable topic-dedup controls:
   - `COASENSUS_TOPIC_DEDUP_ENABLED`
   - `COASENSUS_TOPIC_DEDUP_SIMILARITY`
   - `COASENSUS_TOPIC_DEDUP_MIN_SHARED_TOKENS`
   - `COASENSUS_TOPIC_DEDUP_MAX_PER_CLUSTER`
   - Synced in both `wrangler.api.jsonc` and `wrangler.api.ci.jsonc` for root/staging/production.
149. Added execution-memory guardrail doc:
   - `docs/ROADMAP_QUEUE.md` with `Now / Next / Later` queue to keep momentum without losing deferred tasks.
150. Validation for topic dedup milestone:
   - `npm run check` => success
   - `npx wrangler deploy --dry-run --config infra/cloudflare/wrangler.api.ci.jsonc --env staging` => success.
151. Staging rollout for topic dedup:
   - deployed Worker version `a5edbc64-8169-4e94-a10e-b667da8f3865`
   - post-refresh monitor run `22239209118` => success
   - latest staging refresh snapshot:
     - `runId 2026-02-20T20-00-13-558Z`
     - `llmEnabled=true`
     - `llmAttempts=1`
     - `llmFailures=0`.
152. Staging impact from topic dedup (post-refresh):
   - curated total reduced from `145` to `84`
   - top-20 mix improved toward story diversity (`politics: 17`, `geopolitics: 3`)
   - dedup exclusions observed: `133` rows with `excluded_topic_duplicate_of_*`.
153. Closed out post-merge production verification for topic dedup:
   - monitor production workflow run `22239669070` => success
   - latest production run snapshot: `runId 2026-02-20T20-15-11-010Z`, `totalItems: 83`, no semantic failures.
154. Started `MILESTONE-UI-SEARCH-002` on branch `agent/ui-search-pass1`.
155. API feed search support added:
   - `GET /api/feed` now accepts `q` (and alias `search`)
   - search applies case-insensitive matching against `question` and `description`
   - `meta.searchQuery` returned in feed response for transparency.
156. Web search controls added:
   - new search input in `apps/web/public/index.html`
   - UI now sends `q` query parameter, shows active search chip, and tracks `search_changed` analytics events.
157. Query builder tests expanded:
   - added positive test for normalized search query inclusion (`q=...`)
   - added guard test for omitting empty search values.
158. Validation for search milestone pass #1:
   - `npm run --workspace @coasensus/web test` => success
   - `npm run --workspace @coasensus/web typecheck` => success
   - `npm run check` => success.
159. Staging rollout validation for search milestone:
   - deployed `coasensus-api-staging` version `9400852c-f74b-4626-926b-12c5d7793400`
   - smoke check `GET /api/feed?...&q=election` => `200`, `meta.searchQuery="election"`, non-zero results.
160. Promoted search milestone to `main`:
   - merged branch `agent/ui-search-pass1` as commit `a9b29ed`
   - CI run `22239925428` => success
   - Deploy Cloudflare run `22239925419` => success.
161. Post-deploy production + staging verification:
   - production search smoke: `https://coasensus.com/api/feed?...&q=election` => `200`, `totalItems=59`
   - staging search smoke: `https://staging.coasensus.com/api/feed?...&q=election` => `200`, `totalItems=59`
   - manual monitor runs succeeded:
     - production `22239978136`
     - staging `22239979666`
   - semantic-metrics endpoint checks remained healthy in both monitor runs.
162. Started `MILESTONE-REGION-003` on branch `agent/region-filter-pass1`.
163. Added curated-feed region persistence:
   - new D1 migration `0005_curated_feed_geo_tag.sql` adds `curated_feed.geo_tag` with index.
   - refresh pipeline now carries semantic `geoTag` through curation and writes it to `curated_feed` when column is present.
164. Added API region support:
   - `GET /api/feed` now accepts `region` (alias `geoTag`), normalized to `US|EU|Asia|Africa|MiddleEast|World`.
   - feed items now return `geoTag`.
   - response meta now includes `region` and `regionFilterApplied`.
165. Added web region controls:
   - new region select in feed controls (`All, US, EU, Asia, Africa, Middle East, World`).
   - UI sends `region` query parameter and renders region badge on cards.
   - analytics now captures `region_changed`, feed load region state, and clicked-card region.
166. Query builder updates:
   - `apps/web/src/query.ts` now supports `region` parameter.
   - tests updated to assert `region=US` inclusion.
167. Local validation status in this sandbox:
   - `npm.cmd run typecheck` => success
   - `npm.cmd run lint` => success
   - `npm.cmd run check` blocked at test stage due sandbox process spawn restrictions (`vitest` `spawn EPERM`).
   - local `wrangler` dry-run/deploy not executable in this sandbox because npm registry access is blocked for fetching `wrangler`.
168. Promoted region milestone to `main`:
   - merged branch `agent/region-filter-pass1` as commit `1c4f5de`
   - CI run `22252557586` => success
   - Deploy Cloudflare run `22252557594` => success (production migration+deploy path).
169. Completed staging rollout for region milestone:
   - applied migration `0005_curated_feed_geo_tag.sql` on `coasensus-staging` via Wrangler
   - deployed staging Worker version `6e2cb160-ec74-4168-8f36-6dae70276a4e`.
170. Region filter smoke verification:
   - production `GET /api/feed?...&region=US` => `200`, `regionFilterApplied=true`, first item `geoTag=US`, `totalItems=48`
   - staging `GET /api/feed?...&region=US` => `200`, `regionFilterApplied=true`, first item `geoTag=US`, `totalItems=45`.
171. Post-rollout monitor verification:
   - production monitor `22252721036` => success (`totalItems=86`, `llmFailures=0`, runId `2026-02-21T07-15-27-694Z`)
   - staging monitor `22252722052` => success (`totalItems=85`, `llmFailures=0`, runId `2026-02-21T07-22-35-107Z`).
172. Started `MILESTONE-TREND-004` on branch `agent/trend-shift-pass1`.
173. Added curated-feed trend persistence:
   - new D1 migration `0006_curated_feed_trend_delta.sql` adds `curated_feed.trend_delta` with descending index.
   - refresh pipeline now computes per-market trend shift during snapshot replacement:
     - `trend_delta = current_front_page_score - previous_front_page_score` for same `market_id`
     - defaults to `0` when no previous score exists.
174. Added API trend support:
   - `/api/feed` now supports `sort=trend`.
   - feed items now include `trendDelta`.
   - response meta includes `requestedSort` and `trendSortAvailable`.
175. Added web trend controls and indicator:
   - sort control now includes `Trending up`.
   - cards now render trend badge (`Trend ↑`, `Trend ↓`, `Trend ↔`) derived from `trendDelta`.
176. Shared contract update:
   - `packages/shared-types` now includes `GeoTag` and optional `trendDelta` on `CuratedFeedItem`.
177. Validation for trend milestone:
   - `npm run check` => success
   - `npx wrangler deploy --dry-run --config infra/cloudflare/wrangler.api.ci.jsonc --env staging` => success.
178. Staging rollout for trend milestone:
   - applied migration `0006_curated_feed_trend_delta.sql` to `coasensus-staging`
   - deployed staging worker version `60ae8bdd-a633-4050-9f79-4a689f53aaec`.
179. Staging trend smoke checks:
   - `GET /api/feed?...&sort=trend` => `200`, `sort=trend`, `requestedSort=trend`, `trendSortAvailable=true`
   - `GET /api/feed?...&sort=trend&region=US` => `200`, region filter and geo tags still valid.
180. Promoted trend milestone to `main`:
   - merged branch `agent/trend-shift-pass1` as commit `cc06189`
   - CI run `22252881208` => success
   - Deploy Cloudflare run `22252881209` => success.
181. Production + staging trend verification:
   - production `GET /api/feed?...&sort=trend` => `200`, `trendSortAvailable=true`, `requestedSort=trend`
   - staging `GET /api/feed?...&sort=trend` => `200`, `trendSortAvailable=true`, `requestedSort=trend`.
182. Post-rollout monitors for trend milestone:
   - production monitor `22252904455` => success (`totalItems=86`, `llmFailures=0`, runId `2026-02-21T07-30-28-219Z`)
   - staging monitor `22252905034` => success (`totalItems=85`, `llmFailures=0`, runId `2026-02-21T07-30-27-972Z`).
183. Started `MILESTONE-ALERT-005` on branch `agent/alerting-pass1`.
184. Upgraded monitor alerting logic in `scripts/monitor-production.mjs`:
   - added explicit alert codes in failure messages:
     - `[ALERT_EMPTY_FEED]`
     - `[ALERT_STALE_FEED]`
     - `[ALERT_SEMANTIC_FAILURE_STREAK]`
   - added configurable `COASENSUS_SEMANTIC_FAILURE_STREAK` (default `3`), and telemetry query now fetches a matching run window.
   - semantic streak alert triggers when latest N runs all have `llmEnabled=true`, `llmAttempts>0`, and `llmFailures>0`.
185. Updated monitor workflow env configuration:
   - `.github/workflows/monitor-production.yml` now sets `COASENSUS_SEMANTIC_FAILURE_STREAK=3`.
   - `.github/workflows/monitor-staging.yml` now sets `COASENSUS_SEMANTIC_FAILURE_STREAK=3`.
186. Milestone bookkeeping updated:
   - `docs/ROADMAP_QUEUE.md` marks `MILESTONE-ALERT-005` complete and promotes `MILESTONE-RATE-006` to active.
   - `docs/ISSUE_CHECKLIST.md` adds `QA-006` as completed (`explicit monitor alerts for stale feed + semantic failure streaks`).
187. Promoted alert milestone to `main`:
   - merged PR `#1` as commit `80da77b`.
188. Post-merge pipeline status:
   - CI run `22253096764` => success
   - Deploy Cloudflare run `22253096757` => success.
189. Post-merge monitor verification on `main`:
   - production monitor `22253101327` => success
   - staging monitor `22253101546` => success.
190. Monitor output verification from workflow logs:
   - reports now include `semanticFailureStreak`, `alerts.semanticFailureStreak`, and explicit alert-ready telemetry window data in both environments.
191. Started `MILESTONE-RATE-006` on branch `agent/rate-limit-pass1`.
192. Added per-session analytics sampling + rate limiting in web client (`apps/web/public/app.js`):
   - introduced local analytics policy map with per-event `sampleRate`, `minIntervalMs`, and `maxPerSession`.
   - added session-persistent analytics state (`coasensus_analytics_state_v1`) to maintain event counters across reloads.
   - added global per-session cap (`ANALYTICS_MAX_EVENTS_PER_SESSION=160`) to avoid runaway writes.
193. Applied targeted high-noise throttles:
   - `feed_loaded` now sampled at `0.4`, minimum interval `60s`, max `24` events/session.
   - pagination events now sampled at `0.5`, minimum interval `2s`.
   - rapid control change events (`search/sort/category/region/includeRejected`) now rate-limited with cooldowns and caps.
194. Updated web docs and milestone board:
   - `apps/web/README.md` now documents rate-limited/sampled analytics behavior.
   - `docs/ROADMAP_QUEUE.md` marks `MILESTONE-RATE-006` complete and promotes `MILESTONE-TAXONOMY-007` as active.
   - `docs/ISSUE_CHECKLIST.md` adds `QA-007` completed.
195. Validation:
   - `npm run check` => success after analytics throttling implementation.
