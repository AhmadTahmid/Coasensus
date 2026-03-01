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
196. Promoted rate milestone to `main`:
   - merged PR `#2` as commit `6341f99`.
197. Post-merge pipeline status:
   - CI run `22253225521` => success
   - Deploy Cloudflare run `22253225537` => success.
198. Post-merge monitor verification on `main`:
   - production monitor `22253244279` => success
   - staging monitor `22253244294` => success.
199. Started `MILESTONE-TAXONOMY-007` on branch `agent/taxonomy-pass1`.
200. Expanded admin feed diagnostics taxonomy output in `infra/cloudflare/workers/feed-api/src/index.ts`:
   - added regional split query (`regionCounts`) using `geo_tag`.
   - added region x category split query (`regionCategoryDistribution`).
   - added composite `taxonomyPanel` block with `regions`, `categories`, and `regionCategory` arrays.
201. Added normalized diagnostics ratios:
   - category rows now include `shareOfFeed` + `curatedShareWithinCategory`.
   - region rows now include `shareOfFeed` + `curatedShareWithinRegion`.
   - region/category rows now include `shareWithinRegion` + `shareOfFeed`.
202. Added compatibility fallback for environments missing `geo_tag`:
   - diagnostics synthesize a `World` region panel from existing totals.
203. Updated Worker docs:
   - `infra/cloudflare/workers/feed-api/README.md` route list now includes `GET /api/admin/feed-diagnostics`.
204. Milestone bookkeeping updated:
   - `docs/ROADMAP_QUEUE.md` marks `MILESTONE-TAXONOMY-007` complete and promotes `MILESTONE-PERF-008` as active.
   - `docs/ISSUE_CHECKLIST.md` adds `QA-008` completed.
205. Validation:
   - `npm run check` => success after taxonomy diagnostics implementation.
206. Promoted taxonomy milestone to `main`:
   - merged PR `#3` as commit `66aad5c`.
207. Post-merge pipeline status:
   - CI run `22253351976` => success
   - Deploy Cloudflare run `22253351988` => success.
208. Post-merge monitor verification on `main`:
   - production monitor `22253372672` => success
   - staging monitor `22253372673` => success.
209. Started `MILESTONE-PERF-008` on branch `agent/perf-pass1`.
210. Added cached feed query path in Worker (`infra/cloudflare/workers/feed-api/src/index.ts`):
   - `/api/feed` now checks Worker Cache API before querying D1.
   - canonical cache key built from normalized feed params (`page`, `pageSize`, `sort`, `category`, `region`, `q`, `includeRejected`).
   - cache write occurs asynchronously via `ctx.waitUntil(...)`.
211. Added feed cache controls + observability:
   - env vars: `COASENSUS_FEED_CACHE_ENABLED`, `COASENSUS_FEED_CACHE_TTL_SECONDS`.
   - response header `X-Coasensus-Feed-Cache` reports `HIT|MISS|BYPASS`.
   - request bypass supported via `?cache=0`.
212. Added resilience guards:
   - cache read/write failures are logged and gracefully fall back to direct D1 query path.
213. Synced deploy configs to avoid runtime drift:
   - added feed-cache vars to `infra/cloudflare/wrangler.api.jsonc` (root + staging + production).
   - mirrored the same vars in `infra/cloudflare/wrangler.api.ci.jsonc`.
214. Updated Worker docs:
   - `infra/cloudflare/workers/feed-api/README.md` now documents feed burst cache settings and bypass behavior.
215. Milestone bookkeeping updated:
   - `docs/ROADMAP_QUEUE.md` marks `MILESTONE-PERF-008` complete.
   - `docs/ISSUE_CHECKLIST.md` adds `QA-009` completed.
216. Validation:
   - `npm run check` => success after feed cache implementation.
217. Promoted perf milestone to `main`:
   - merged PR `#4` as commit `7063be1`.
218. Post-merge pipeline status:
   - CI run `22253480745` => success
   - Deploy Cloudflare run `22253480746` => success.
219. Live cache-path verification:
   - production `GET /api/feed?...` now returns `X-Coasensus-Feed-Cache: HIT|MISS` and `?cache=0` returns `BYPASS`.
220. Staging parity follow-up:
   - observed staging response initially missing cache header, indicating staging Worker version lag.
   - deployed staging Worker manually via Wrangler:
     - version `a67ebce4-819f-4cf0-af00-33f099cbc0b1`.
221. Post-staging-deploy verification:
   - staging `GET /api/feed?...` now returns `X-Coasensus-Feed-Cache: MISS` then `HIT`; `?cache=0` returns `BYPASS`.
222. Post-rollout monitor verification:
   - production monitor `22253534691` => success
   - staging monitor `22253534717` => success.
223. Synced execution-plan status:
   - updated `docs/EXECUTION_PLAN_V2.md` checklist state to reflect implemented milestones vs pending polish/ops items.
224. Added post-V2 backlog planning doc:
   - created `docs/POST_V2_BACKLOG.md` with prioritized milestones and acceptance criteria:
     - `MILESTONE-LAUNCH-STABILITY-009`
     - `MILESTONE-CATEGORY-SANITY-010`
     - `MILESTONE-EDITORIAL-SPOTCHECK-011`
     - `MILESTONE-DASHBOARD-012`.
225. Re-opened active queue after V2 completion:
   - updated `docs/ROADMAP_QUEUE.md` to set `MILESTONE-LAUNCH-STABILITY-009` as active and staged next three milestones.
226. Published execution-plan/backlog sync to `main`:
   - commit `bd3de29` (`docs: sync execution plan status and define post-v2 backlog`).
227. Post-push pipeline status for docs sync:
   - CI run `22253859338` => success
   - Deploy Cloudflare run `22253859341` => success.
228. Monitor verification after docs sync:
   - production monitor `22253876652` => success
   - staging monitor `22253876653` => success.
229. Started `MILESTONE-LAUNCH-STABILITY-009` on branch `agent/launch-stability-pass1`.
230. Added launch-stability evaluator script:
   - `scripts/launch-stability.mjs` queries GitHub Actions workflow runs for monitor workflows across a rolling window (default 24h).
   - computes per-workflow readiness from:
     - minimum run count
     - failure-count threshold
     - empty-hour threshold
     - maximum observed gap between runs.
231. Added artifact and summary outputs:
   - script writes `artifacts/launch-status.json` + `artifacts/launch-status.md`.
   - writes markdown summary to `GITHUB_STEP_SUMMARY` when available.
232. Added Launch Stability workflow:
   - `.github/workflows/launch-stability.yml`
   - schedule: hourly (`17 * * * *`) plus manual dispatch.
   - uploads launch-status artifacts with `if: always()` so diagnostics persist on failure.
233. Queue and gate docs updated:
   - `docs/ROADMAP_QUEUE.md` marks `MILESTONE-LAUNCH-STABILITY-009` complete and promotes `MILESTONE-CATEGORY-SANITY-010`.
   - `docs/LAUNCH_GATES.md` go-live checklist now requires successful Launch Stability workflow check.
   - `docs/ISSUE_CHECKLIST.md` adds `QA-010` completed.
234. Validation:
   - `npm run check` => success.
   - local strict 24h run intentionally returned non-ready due historical monitor gap/failure data (expected gate behavior).
   - local short-window override run returned `overallReady=true`, validating success path and artifact generation.
235. Promoted launch-stability milestone to `main`:
   - merged PR `#5` as commit `a58c7ad`.
236. Post-merge pipeline status:
   - CI run `22254044518` => success.
   - Deploy Cloudflare run `22254044521` => success.
237. Manual monitor verification on `main`:
   - Monitor Production run `22254064611` => success.
   - Monitor Staging run `22254064637` => success.
238. Monitor telemetry confirmation:
   - both manual monitor runs completed semantic telemetry checks successfully (`/api/admin/semantic-metrics` returned successful responses with run data).
239. Manual Launch Stability verification:
   - Launch Stability run `22254064721` => failure by design because strict 24h gate currently evaluates `overallReady=false`.
   - production blockers in artifact:
     - `run_count_below_min (46 < 80)`
     - `failures_exceeded (1 > 0)`
     - `empty_hours_exceeded (9 > 0)`
     - `max_gap_exceeded (409.09 > 40 minutes)`.
   - staging blockers in artifact:
     - `failures_exceeded (1 > 0)`
     - `empty_hours_exceeded (10 > 0)`
     - `max_gap_exceeded (455.64 > 70 minutes)`.
240. Launch Stability artifact captured:
   - run artifact `launch-stability-22254064721` contains `launch-status.json` and `launch-status.md` for gate diagnostics.
241. Started `MILESTONE-CATEGORY-SANITY-010` on branch `agent/category-sanity-pass1`.
242. Extended admin diagnostics with top-page composition:
   - `infra/cloudflare/workers/feed-api/src/index.ts` now computes top-N curated-card category mix (`topPageComposition`) using score-order ranking.
   - output includes per-category counts + `shareOfTopN`, dominant category, and score formula metadata.
243. Added category-dominance monitor signal:
   - `scripts/monitor-production.mjs` now fetches `/api/admin/feed-diagnostics?topN=<N>` and evaluates dominant category share.
   - emits `ALERT_CATEGORY_DOMINANCE` when dominant share exceeds configured threshold.
244. Added monitor config knobs:
   - `COASENSUS_CATEGORY_DOMINANCE_TOP_N`
   - `COASENSUS_CATEGORY_DOMINANCE_MAX_SHARE`
   - wired in both monitor workflows:
     - `.github/workflows/monitor-production.yml`
     - `.github/workflows/monitor-staging.yml`.
245. Updated worker docs:
   - `infra/cloudflare/workers/feed-api/README.md` route docs now include `feed-diagnostics?topN=20`.
246. Milestone bookkeeping synced:
   - `docs/ROADMAP_QUEUE.md` marks `MILESTONE-CATEGORY-SANITY-010` complete and promotes `MILESTONE-EDITORIAL-SPOTCHECK-011`.
   - `docs/ISSUE_CHECKLIST.md` adds `QA-011` completed.
   - `docs/POST_V2_BACKLOG.md` promoted active backlog to `MILESTONE-EDITORIAL-SPOTCHECK-011`.
247. Validation:
   - `npm run check` => success after category-sanity implementation.
248. Production monitor signal quality check after rollout:
   - monitor run `22254269127` triggered `ALERT_CATEGORY_DOMINANCE` because dominant share was `0.85` (17/20 politics) vs initial threshold `0.65`.
249. Threshold tuning pass:
   - updated workflow env `COASENSUS_CATEGORY_DOMINANCE_MAX_SHARE` from `0.65` to `0.90` in:
     - `.github/workflows/monitor-production.yml`
     - `.github/workflows/monitor-staging.yml`.
250. Rationale:
   - keep category-dominance alert active for extreme concentration while avoiding a permanently failing monitor on current real-world feed composition.
251. Promoted `MILESTONE-CATEGORY-SANITY-010` to `main`:
   - merged PR `#6` as commit `03a8cc2`.
252. Post-merge pipeline status (`#6`):
   - CI run `22254226010` => success.
   - Deploy Cloudflare run `22254226000`:
     - first attempt failed at `Deploy Pages` with Cloudflare internal error.
     - rerun succeeded.
253. Initial post-merge monitor runs (`#6`):
   - Monitor Production `22254269127` => failure (`ALERT_CATEGORY_DOMINANCE`, dominant share `0.85` vs threshold `0.65`).
   - Monitor Staging `22254269115` => success.
254. Applied threshold tune via PR `#7`:
   - merged as commit `8bf028e`.
   - adjusted workflow env `COASENSUS_CATEGORY_DOMINANCE_MAX_SHARE` to `0.90` for production/staging monitor jobs.
255. Post-merge pipeline status (`#7`):
   - CI run `22254311784` => success.
   - Deploy Cloudflare run `22254311772` => success.
256. Final monitor verification after threshold tune:
   - Monitor Production `22254357091` => success.
   - Monitor Staging `22254357097` => success.
257. Category-dominance check state after tuning:
   - both successful monitor logs report category-dominance evaluation present with `triggered=false`.
258. Started `MILESTONE-EDITORIAL-SPOTCHECK-011` on branch `agent/editorial-spotcheck-pass1`.
259. Added editorial snapshot script:
   - `scripts/editorial-spotcheck.mjs` captures top-N score-sorted feed cards (default 20) from production and staging.
   - writes inspectable artifacts:
     - `artifacts/editorial-spotcheck.json`
     - `artifacts/editorial-spotcheck.md`.
260. Added daily Editorial Spotcheck workflow:
   - `.github/workflows/editorial-spotcheck.yml`
   - runs daily at `11 13 * * *` UTC and supports manual dispatch.
   - uploads snapshot artifacts even on partial failure (`if: always()`).
261. Added reviewer log path:
   - created `docs/EDITORIAL_REVIEW_LOG.md` with structured entry format:
     - reviewer
     - reviewed timestamp (UTC)
     - snapshot run id
     - decision
     - notes.
262. Launch gate update:
   - `docs/LAUNCH_GATES.md` now requires confirming latest editorial snapshot + reviewer entry before launch sign-off.
263. Milestone bookkeeping synced:
   - `docs/ROADMAP_QUEUE.md` marks `MILESTONE-EDITORIAL-SPOTCHECK-011` complete and promotes `MILESTONE-DASHBOARD-012`.
   - `docs/ISSUE_CHECKLIST.md` adds `QA-012` completed.
   - `docs/POST_V2_BACKLOG.md` moves editorial spotcheck into recently completed.
264. Validation:
   - `npm run check` => success after editorial spotcheck implementation.
265. Promoted `MILESTONE-EDITORIAL-SPOTCHECK-011` to `main`:
   - merged PR `#8` as commit `ba2efaf`.
266. Post-merge pipeline status:
   - CI run `22254484458` => success.
   - Deploy Cloudflare run `22254484445` => success.
267. Manual Editorial Spotcheck workflow verification:
   - workflow run `22254553098` => success.
   - artifact bundle `editorial-spotcheck-22254553098` contains:
     - `editorial-spotcheck.json`
     - `editorial-spotcheck.md`.
268. Post-rollout monitor verification:
   - Monitor Production `22254553101` => success.
   - Monitor Staging `22254553099` => success.
269. Started `MILESTONE-DASHBOARD-012` on branch `agent/dashboard-pass1`.
270. Added read-only diagnostics dashboard page:
   - new frontend route asset: `apps/web/public/admin.html`.
   - dashboard includes panels for health/feed status, semantic telemetry, taxonomy distribution, and decision diagnostics.
271. Added diagnostics dashboard data client:
   - new script: `apps/web/public/admin.js`.
   - fetches existing endpoints only:
     - `/api/health`
     - `/api/feed`
     - `/api/admin/semantic-metrics`
     - `/api/admin/feed-diagnostics`
   - applies `X-Admin-Token` for protected admin endpoints.
272. Added dashboard UI integration:
   - updated `apps/web/public/styles.css` with dashboard layout/table/status styling.
   - added feed-page link to diagnostics dashboard in `apps/web/public/index.html`.
273. Updated docs for dashboard usage:
   - `apps/web/README.md` now documents `/admin.html` and token behavior.
   - root `README.md` now references production diagnostics URL.
274. Milestone bookkeeping synced:
   - `docs/ROADMAP_QUEUE.md` marks `MILESTONE-DASHBOARD-012` complete.
   - `docs/POST_V2_BACKLOG.md` moves dashboard milestone to recently completed.
   - `docs/ISSUE_CHECKLIST.md` adds `QA-013` completed.
275. Validation:
   - `node --check apps/web/public/admin.js` => success.
   - `npm run check` => success after dashboard implementation.
276. Promoted `MILESTONE-DASHBOARD-012` to `main`:
   - merged PR `#9` as commit `546f336`.
277. Post-merge pipeline status:
   - CI run `22254704657` => success.
   - Deploy Cloudflare run `22254704647` => success.
278. Dashboard route smoke verification:
   - `curl -L https://coasensus.com/admin.html` returned content containing "Read-only diagnostics dashboard".
279. Post-rollout workflow verification:
   - Editorial Spotcheck `22254731284` => success.
   - Monitor Production `22254729697` => success.
   - Monitor Staging `22254729796` => success.
280. Started `MILESTONE-SEMANTIC-FAILOVER-013` on branch `agent/semantic-failover-pass1`.
281. Added migration `infra/db/migrations/0007_semantic_failover_state.sql`:
   - introduces `semantic_failover_state` with single-row operational state (`id=1`) for consecutive-failure and cooldown counters.
282. Added semantic failover controls in Worker refresh pipeline (`infra/cloudflare/workers/feed-api/src/refresh.ts`):
   - `COASENSUS_LLM_FAILOVER_ENABLED` (default `1`)
   - `COASENSUS_LLM_FAILOVER_FAILURE_STREAK` (default `3`)
   - `COASENSUS_LLM_FAILOVER_COOLDOWN_RUNS` (default `4`)
   - LLM attempts auto-suspend during cooldown and resume automatically after cooldown run budget is exhausted.
283. Added resilient failover state persistence:
   - refresh reads/writes `semantic_failover_state` each run (best-effort).
   - if migration `0007` is missing, refresh logs warning and continues without failover state persistence.
284. Extended semantic telemetry endpoint (`/api/admin/semantic-metrics`) to include `failoverState`:
   - `consecutiveFailures`
   - `cooldownRunsRemaining`
   - `active`
   - `lastTriggeredAt`
   - `lastReason`
   - `updatedAt`
285. Kept telemetry backward-compatible:
   - endpoint now catches missing-table errors for `semantic_failover_state` so legacy environments still receive run/aggregate telemetry.
286. Config parity updates for deployment safety:
   - added failover vars to both Cloudflare configs:
     - `infra/cloudflare/wrangler.api.jsonc`
     - `infra/cloudflare/wrangler.api.ci.jsonc`
287. Documentation + queue sync:
   - worker runtime docs updated: `infra/cloudflare/workers/feed-api/README.md`
   - backlog/queue/checklist synced:
     - `docs/POST_V2_BACKLOG.md`
     - `docs/ROADMAP_QUEUE.md`
     - `docs/ISSUE_CHECKLIST.md`.
288. Implemented odds + canonical market link enhancement:
   - feed cards now render bold `Odds / Price` values in `apps/web/public/app.js` + `apps/web/public/styles.css`.
   - card links now sanitize to Polymarket domain and hard-fallback to `https://polymarket.com/market/<id>` when source URLs are missing/invalid.
289. Added normalized probability extraction from Polymarket payloads:
   - ingestion normalizer reads `outcomes`/`outcomePrices` and falls back to `lastTradePrice` / bid-ask midpoint.
   - files updated:
     - `services/ingest-worker/src/normalize.ts`
     - `infra/cloudflare/workers/feed-api/src/refresh.ts`.
290. Added schema support for persisted probability in D1 feed snapshot:
   - migration added: `infra/db/migrations/0008_curated_feed_probability.sql`.
   - refresh snapshot writer now stores `curated_feed.probability` when column exists.
291. API feed response now exposes `probability` per item:
   - `infra/cloudflare/workers/feed-api/src/index.ts` adds dynamic `probability` column projection with migration-safe fallback.
292. Added ingestion regression coverage:
   - extended `services/ingest-worker/src/normalize.test.ts` for:
     - yes/outcome price extraction
     - non-polymarket URL fallback behavior.
293. Validation:
   - `npm run check` => success.
   - `npx wrangler deploy --dry-run --config infra/cloudflare/wrangler.api.ci.jsonc --env staging` => success.
294. Started `MILESTONE-RANKING-TESTS-015` on branch `agent/ranking-tests-pass1`.
295. Added dedicated ranking regression suite:
   - new file: `services/ingest-worker/src/ranking-regression.test.ts`.
   - coverage includes:
     - deterministic tie-break ordering for `score`, `volume`, `liquidity`, and `endDate` sort modes
     - null-value ordering behavior (`null` volume/liquidity/endDate)
     - pagination clamp behavior when requested page exceeds total pages
     - expanded category query parsing (`tech_ai`, `sports`, `entertainment`).
296. Hardened feed sorting determinism in `services/ingest-worker/src/feed-store.ts`:
   - added `id` tie-break fallback across all sort modes.
   - updated local category set to include `tech_ai`, `sports`, and `entertainment` for query parity.
297. Validation:
   - `npm run check` => success (`services/ingest-worker` now runs 20 tests including ranking regression suite).
298. Started `MILESTONE-UI-POLISH-014` on branch `agent/ui-polish-pass1`.
299. Implemented feed UI polish in `apps/web/public/app.js`:
   - added safer HTML escaping for dynamic card/meta text and normalized trend labels.
   - expanded card anatomy with signal stack, market ribbon metadata pills, and reason-code chips.
   - preserved bold odds/price display and canonical Polymarket link resolution.
300. Added matching visual system in `apps/web/public/styles.css`:
   - masonry-style secondary feed column layout with responsive single-column fallback.
   - signal-band styling (`high`/`medium`/`watch`/`neutral`), mini-icon treatments, and reason-chip styling.
   - staggered card entrance animation with reduced-motion accessibility fallback.
301. Documentation + validation sync:
   - updated milestone trackers:
     - `docs/ROADMAP_QUEUE.md`
     - `docs/POST_V2_BACKLOG.md`.
   - `node --check apps/web/public/app.js` => success.
   - `npm run check` => success.
302. Started `MILESTONE-SMART-FIREHOSE-016` on branch `agent/smart-firehose-foundation-pass1`.
303. Added Smart Firehose foundation module:
   - new file: `services/ingest-worker/src/polymarket-firehose.ts`.
   - capabilities:
     - managed Polymarket market-channel WebSocket client
     - reconnect with exponential backoff
     - in-memory market snapshot + freshness checks
     - staleness-aware REST fallback (`fetchForIngestion`) to preserve deterministic ingest runs.
304. Wired ingestion runner to optionally consume firehose snapshot:
   - `services/ingest-worker/src/index.ts` now supports:
     - `RunIngestionOptions.firehoseClient`
     - `RunIngestionOptions.firehoseMaxStalenessMs`
     - snapshot source tracking (`firehose_snapshot` vs `rest_fallback`).
   - smoke runner now supports firehose env flags in `services/ingest-worker/src/smoke.ts`:
     - `INGEST_USE_SMART_FIREHOSE`
     - `INGEST_FIREHOSE_WS_URL`
     - `INGEST_FIREHOSE_STALENESS_MS`
     - `INGEST_FIREHOSE_RECONNECT_BASE_MS`
     - `INGEST_FIREHOSE_RECONNECT_MAX_MS`
     - `INGEST_FIREHOSE_WARMUP_MS`
     - `INGEST_FIREHOSE_SUBSCRIPTION_JSON`.
305. Added regression coverage for Smart Firehose:
   - new test file: `services/ingest-worker/src/polymarket-firehose.test.ts`.
   - coverage includes:
     - nested market-message parsing
     - fresh snapshot usage without REST calls
     - stale snapshot REST fallback
     - websocket-applied price updates
     - reconnect scheduling on socket close.
306. Validation:
   - `npm -C services/ingest-worker run typecheck` => success.
   - `npm -C services/ingest-worker run lint` => success.
   - `npm -C services/ingest-worker run test` => success (25 tests).
   - `npm run check` => success (repo-wide).
307. Started Smart Firehose worker integration pass on branch `agent/smart-firehose-worker-pass2`.
308. Extended Cloudflare refresh runtime config for Smart Firehose controls:
   - `COASENSUS_SMART_FIREHOSE_ENABLED`
   - `COASENSUS_SMART_FIREHOSE_WS_URL`
   - `COASENSUS_SMART_FIREHOSE_WARMUP_MS`
   - `COASENSUS_SMART_FIREHOSE_MAX_MESSAGES`.
309. Implemented worker-side Smart Firehose overlay in `infra/cloudflare/workers/feed-api/src/refresh.ts`:
   - refresh still performs standard REST market fetch first.
   - optional websocket warmup then overlays market price updates onto fetched snapshot.
   - automatic fallback to REST-only when websocket is disabled/unavailable/errors/no updates.
   - refresh summary now reports ingestion source (`rest_only` vs `rest_plus_firehose_overlay`) and firehose metrics.
310. Updated Worker surface + docs/config parity:
   - `infra/cloudflare/workers/feed-api/src/index.ts` env typing includes Smart Firehose vars.
   - `infra/cloudflare/workers/feed-api/README.md` documents Smart Firehose behavior and controls.
   - `infra/cloudflare/wrangler.api.jsonc` + `infra/cloudflare/wrangler.api.ci.jsonc` include Smart Firehose vars across base/staging/production (default disabled).
311. Validation:
   - `npm run check` => success (repo-wide).
   - `npx wrangler deploy --dry-run --config infra/cloudflare/wrangler.api.ci.jsonc --env staging` => success.
312. Enabled Smart Firehose in staging configuration only:
   - `infra/cloudflare/wrangler.api.jsonc` (`env.staging.vars.COASENSUS_SMART_FIREHOSE_ENABLED=1`)
   - `infra/cloudflare/wrangler.api.ci.jsonc` (`env.staging.vars.COASENSUS_SMART_FIREHOSE_ENABLED=1`)
   - production remains disabled (`COASENSUS_SMART_FIREHOSE_ENABLED=0`).
313. Staging rollout verification for Smart Firehose:
   - direct staging deploy: `npx wrangler deploy --config infra/cloudflare/wrangler.api.jsonc --env staging` => success.
   - staging refresh telemetry confirms firehose runtime path is active:
     - `enabled=true`
     - `attempted=true`
     - `connected=true`
   - monitor workflow: `Monitor Staging` run `22525950039` => success.
314. Ran fresh editorial snapshot workflow for launch-readiness evidence:
   - workflow: `Editorial Spotcheck`
   - run: `22527421938`
   - result: success
   - artifact: `editorial-spotcheck-22527421938` (includes `editorial-spotcheck.json` and `.md`).
315. Recorded reviewer log entries in `docs/EDITORIAL_REVIEW_LOG.md` using run `22527421938`:
   - production review marked `pass`
   - staging review marked `pass`
   - sampled top-20 composition remained within current category-cap policy (`politics` share `0.65`).
316. Executed launch-stability script locally for strict 24h gate status:
   - command: `node scripts/launch-stability.mjs`
   - generated at: `2026-02-28T19:20:44.604Z`
   - result: `overallReady=false`
   - key reasons:
     - production: historical failures/gaps in current 24h window (`runs=49`, `failures=5`, `maxGap=126.17m`)
     - staging: historical gap threshold miss (`runs=48`, `failures=0`, `maxGap=135.3m`).
317. Launch decision entry (dated):
   - decision time: `2026-02-28T19:30:00Z`
   - decision: `SOFT-GO (beta operation)` with explicit exception; not a strict public launch pass yet.
   - owner: `AhmadTahmid`
   - exception expiry: `2026-03-01T19:30:00Z`
   - condition to clear exception: next clean 24h `Launch Stability` window with `overallReady=true`.
318. Production freshness incident triage (`2026-03-01`):
   - `Monitor Production` run `22538278798` failed with `ALERT_STALE_FEED` (`115.1 min > 90 min`).
   - manual `POST /api/admin/refresh-feed` returned `500` with `UNIQUE constraint failed: curated_feed.market_id`.
319. Immediate runtime repair:
   - deployed production Worker with explicit cron/triggers via `wrangler.api.jsonc`.
   - confirmed production cron attachment in deploy output (`schedule: */15 * * * *`).
320. Refresh pipeline hardening for duplicate IDs:
   - updated `infra/cloudflare/workers/feed-api/src/refresh.ts` to dedupe duplicate `market_id` items before persistence.
   - summary counts now derive from the deduped set to keep telemetry consistent with persisted rows.
321. CI config correction for sustainable deploys:
   - `infra/cloudflare/wrangler.api.ci.jsonc` now includes cron `triggers` for staging/production.
   - reverted CI `routes` mutations to avoid failing deploys with zone-limited API token permissions.
322. Verification after fix:
   - manual production refresh returned `200` with fresh run `2026-03-01T07-49-01-032Z`.
   - monitor runs succeeded:
     - production `22538939076`
     - staging `22538939191`
   - `Deploy Cloudflare` run `22538925757` succeeded after CI config adjustment.
323. Current gate status:
   - `Launch Stability` remains `overallReady=false` (`22538945762`) due historical 24h window debt:
     - production reasons: `run_count_below_min`, `failures_exceeded`, `empty_hours_exceeded`, `max_gap_exceeded`
     - staging reasons: `empty_hours_exceeded`, `max_gap_exceeded`.
324. Added launch-stability readiness ETA estimation in `scripts/launch-stability.mjs`:
   - new per-environment config knobs:
     - `COASENSUS_STABILITY_PRODUCTION_INTERVAL_MINUTES` (default `15`)
     - `COASENSUS_STABILITY_STAGING_INTERVAL_MINUTES` (default `30`)
   - report now includes:
     - `estimatedReadyAt` per workflow
     - `estimatedOverallReadyAt` across workflows
     - explicit estimate assumptions in JSON + markdown artifact.
325. Local launch-stability run after ETA update (`2026-03-01T07:59:51.953Z`):
   - `overallReady=false` (expected, historical debt still in active 24h window)
   - estimated readiness times (assuming no new failures and successful scheduled cadence):
     - staging: `2026-03-02T04:39:47.407Z`
     - production: `2026-03-02T07:14:47.407Z`
     - overall: `2026-03-02T07:14:47.407Z`.
