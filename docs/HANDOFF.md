# Handoff Guide (Fresh Agent Resume)

## Why this file exists
A new Codex session does not inherit hidden memory from older sessions.  
This file is the explicit handoff checkpoint.

## Read this first
1. `00_START_HERE.md`
2. `README.md`
3. `docs/PROGRESS_LOG.md`
4. `docs/ISSUE_CHECKLIST.md`
5. `COASENSUS_EXECUTION_PLAN.md`
6. `docs/FILTER_ALGORITHM.md`
7. `docs/DEPLOY_VERIFICATION_CHECKLIST.md`
8. `docs/LAUNCH_GATES.md`

## Current checkpoint
1. Last pushed commit on active execution branch: run `git log --oneline -n 1`
2. Repo: `https://github.com/AhmadTahmid/Coasensus`
3. Baseline branch: `main`
4. Active execution branch for new plan: merged to `main` at `51fb526`; start new work from fresh task branches.
5. Core stack status:
   - Ingestion client: implemented
   - Local persistence: implemented (`infra/db/local`)
   - Feed API: implemented (`/health`, `/feed`)
   - Web UI cards: implemented (`apps/web`)
   - Cloudflare API worker scaffold: implemented (`infra/cloudflare/workers/feed-api`)
   - Cloudflare deploy pipeline scaffold: implemented (`.github/workflows/deploy-cloudflare.yml`)
   - First staging deploy: completed (Worker + D1 migration + Pages preview)
   - First production deploy: completed (Worker + D1 migration + Pages deployment)
   - Cloudflare D1 feed refresh pipeline: implemented and live
   - Manual refresh endpoint: implemented (`POST /api/admin/refresh-feed`)
   - Scheduled refresh: implemented (staging every 30m, production every 15m)
   - Admin refresh auth: protected by `COASENSUS_ADMIN_REFRESH_TOKEN` secret
   - Production monitor workflow: implemented (cron every 15m + manual dispatch)
   - Phase-1 bouncer prefilter: implemented (query-level + local fallback gates)
   - Phase-2 semantic layer: implemented (D1 semantic cache + heuristic classifier + optional LLM path)

## Known environment caveats
1. Some sandbox contexts block process spawn for Vitest/Vite and `tsx`.
2. Some sandbox contexts block outbound network calls (live Polymarket fetch can fail).
3. If that happens, validate with:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run dev:feed-api` against existing local persisted data
   - `npm run dev:web`
4. Cloudflare deploy requires real credentials and IDs:
   - replace `database_id` placeholders in `infra/cloudflare/wrangler.api.jsonc`
   - set GitHub secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`)
5. Staging live endpoints checkpoint:
   - Worker health: `https://coasensus-api-staging.tahmidahmad1970.workers.dev/api/health`
   - Pages preview alias: `https://staging.coasensus-web.pages.dev`
6. Production live endpoints checkpoint:
   - Worker health: `https://coasensus-api.tahmidahmad1970.workers.dev/api/health`
   - Pages deployment: `https://coasensus-web.pages.dev`
7. Pages custom domains are active:
   - `https://coasensus.com`
   - `https://staging.coasensus.com`
8. Current deploy IDs:
   - Staging Pages deploy: `d4db533e-c37c-40be-9e16-2d0d83958ed8`
   - Production Pages deploy: `73b297ed-bdce-4db8-9cc0-85c5e3fa3ed1`
9. CI deploy workflow status:
   - Latest `Deploy Cloudflare` run is successful after fixing invalid worker deploy flag.
   - Root cause: `wrangler deploy` was invoked with unsupported `--log-level` option.
10. Feed population checkpoint:
   - `/api/feed` now returns non-empty curated markets in both environments.
   - Latest verified live counts:
     - Production: `800 total / 214 curated / 586 rejected`
     - Staging: `800 total / 214 curated / 586 rejected`
11. Curation tuning checkpoint:
   - Removed false positives from substring matching (`who` keyword bug).
   - Added stronger sports/entertainment exclusions and stricter news threshold.
12. Admin refresh token was rotated after earlier exposure in chat logs.
    - endpoint now requires current token (`401` without/old token, `200` with current token).

## Execution Plan V2 checkpoint (2026-02-20)
1. Semantic cache migration added: `infra/db/migrations/0002_semantic_cache.sql`.
2. Worker refresh summary now returns semantic metrics under `summary.semantic`.
3. Curation now supports semantic-driven decisions (example include reason: `included_semantic_threshold_met`).
4. Category set expanded across API/filter/UI/shared types:
   - `tech_ai`
   - `sports`
   - `entertainment`
5. Optional LLM controls added to Worker env config, default disabled (`COASENSUS_LLM_ENABLED="0"`).
6. Local smoke verification completed:
   - `POST /api/admin/refresh-feed` returned `200` in local wrangler dev
   - feed returned non-empty items and semantic decision reasons
7. Front-page ranking formula milestone completed (`SEM-007`):
   - formula implemented and persisted in `curated_feed.front_page_score`
   - feed API `sort=score` prefers `front_page_score` with fallback to legacy sort if migration missing
   - API now returns `meta.scoreFormula` and per-item `frontPageScore`
8. Staging rollout status:
   - remote D1 migration `0003_front_page_score.sql` applied
   - staging Worker deployed (`335900ab-c578-46e2-af4d-fc14a69d3e12`)
   - note: existing rows show `frontPageScore=0` until next refresh snapshot writes computed scores
9. Post-deploy verification:
   - authenticated staging refresh executed
   - `frontPageScore` values now populated (non-zero) in live staging feed
10. LLM provider support status:
   - semantic classifier supports `openai` and `gemini` providers
   - configure via `COASENSUS_LLM_PROVIDER`
   - Gemini target profile: `gemini-2.5-flash` + `generativelanguage.googleapis.com/v1beta`
11. Staging Gemini status:
   - staging env currently set to Gemini (`COASENSUS_LLM_ENABLED=1`, provider `gemini`)
   - prompt version: `v1-gemini-003-billing`
   - cap: `COASENSUS_LLM_MAX_MARKETS_PER_RUN=8` (attempt-capped; fixed to prevent runaway failures)
   - latest metrics snapshot: `llmAttempts=8`, `llmEvaluated=8`, `llmFailures=0`, `heuristicEvaluated=792`
12. SEM-008 telemetry status:
   - migration added: `infra/db/migrations/0004_semantic_refresh_runs.sql`
   - refresh pipeline persists telemetry rows in `semantic_refresh_runs`
   - admin endpoint live: `GET /api/admin/semantic-metrics?limit=30` (token-protected)
   - semantic summary includes `llmErrorSamples` for quick root-cause visibility when provider calls fail
13. Production rollout status:
   - production DB migrations applied through `0004`
   - production Worker deployed with Gemini profile (`v1-gemini-004-prodcheck`, cap `8`)
   - production admin refresh + semantic metrics endpoint validated (`200`)
   - production `COASENSUS_LLM_API_KEY` now set and verified live (`llmEvaluated=8`, `llmFailures=0`)
14. Pending next milestone:
   - tune semantic thresholds and ranking weights using observed outcomes
   - increase LLM cap gradually if/when provider quota allows
   - optionally align staging/production prompt versions after evaluation window
15. Post-merge reliability checkpoint:
   - `feat/execution-plan-v2` merged into `main` and pushed (`51fb526`)
   - production smoke checks passed (`/api/health`, `/api/feed`, `/api/admin/semantic-metrics` auth path)
   - monitor workflow added: `.github/workflows/monitor-production.yml`
   - monitor script: `scripts/monitor-production.mjs`
   - required GitHub secret for monitor: `COASENSUS_ADMIN_REFRESH_TOKEN`
16. Reliability runbook checkpoint:
   - `QA-004` complete: `docs/DEPLOY_VERIFICATION_CHECKLIST.md`
   - `QA-005` complete: `docs/LAUNCH_GATES.md`
   - execution board now shows all EPIC-05 items complete
17. CI lockfile checkpoint:
   - fixed `npm ci` failure by syncing `package-lock.json` with `@coasensus/llm-editor` workspace
   - local `npm ci` and `npm run check` now pass again
18. CI diagnostics checkpoint:
   - CI workflow now runs tests per workspace for clearer failing-package visibility
   - Linux Node 22 container validation passed for new CI test commands
19. CI ingest-worker stabilization:
   - `ingest-worker` CI test step now uses single-worker forks mode to reduce flaky runner behavior
   - Linux container validation passed with updated ingest-worker command
20. CI dependency resolution fix:
   - `filter-engine` build step added before tests so downstream import (`@coasensus/filter-engine`) resolves during ingest-worker suite.
   - full CI-equivalent Linux container run now passes from clean `dist/` state.
21. Monitoring + pipeline status:
   - first scheduled monitor run succeeded (`22230889095`)
   - latest CI run succeeded (`22230993533`)
   - latest Deploy Cloudflare run succeeded (`22230993568`)
22. Parallel sprint checkpoint (2026-02-20):
   - Added admin diagnostics endpoint: `GET /api/admin/feed-diagnostics` (token-protected)
   - Enhanced web feed presentation with lead card + frontPageScore emphasis
   - Added staging monitor workflow: `.github/workflows/monitor-staging.yml`
   - Monitor script now emits explicit success flag and richer failure context
23. Validation checkpoint for parallel sprint:
   - `npm run check` passed
   - workflow YAML parsing passed for production and staging monitor workflows
24. Staging monitor caveat:
   - workflow is active, but latest manual run (`22232501844`) failed with `401` on `/api/admin/semantic-metrics`
   - GitHub secret `COASENSUS_ADMIN_REFRESH_TOKEN` must match staging Worker admin token for green staging monitor runs.
25. CI deploy config checkpoint (semantic consistency):
   - fixed `infra/cloudflare/wrangler.api.ci.jsonc` to include full runtime vars for staging/production
   - prevents CI deploys from silently reverting to code defaults (e.g., `llmEnabled=false`, provider fallback)
   - next `Deploy Cloudflare` run should re-apply intended Gemini semantic profile in production.
26. Semantic profile reactivation verification:
   - merged fix to `main` (`530e567`) and deployed successfully
   - production refresh telemetry now confirms `llmEnabled=true`, `llmProvider=gemini`, `llmModel=gemini-2.5-flash`
   - staging telemetry remains aligned on Gemini profile.
27. Semantic tuning pass #1 (in progress on `agent/semantic-tuning-pass1`):
   - worker refresh pipeline now prioritizes cache-miss candidates for LLM usage by market signal + civic hints
   - strict meme-token candidates no longer consume LLM attempt budget
   - added category-specific semantic news floors:
     - `COASENSUS_LLM_MIN_NEWS_SCORE_SPORTS=72`
     - `COASENSUS_LLM_MIN_NEWS_SCORE_ENTERTAINMENT=78`
   - added explicit rejection reasons:
     - `excluded_semantic_below_civic_threshold`
     - `excluded_semantic_news_threshold_<category>`
   - staging deploy completed (`4ea11048-538b-4c2f-b710-ecc2238b8174`) and monitor checks are green.
28. Pending verification for pass #1:
   - wait for a post-deploy staging refresh run and compare category distribution/top-card composition before promoting to production.
29. Pass #1 staging verification complete:
   - latest staging run after deploy: `2026-02-20T18-30-16-036Z`
   - telemetry healthy: `llmAttempts=1`, `llmEvaluated=1`, `llmFailures=0`
   - curated feed tightened from `273` -> `218` items
   - top 20 cards are now entirely politics/civic
   - sports/entertainment suppression confirmed:
     - `sports`: `207` total, `1` curated
     - `entertainment`: `96` total, `0` curated
30. Next recommended step:
   - promote tuning patch to `main`, let CI deploy production, then verify production metrics + category composition with monitor and feed sampling script.
31. Pass #1 promoted and verified in production:
   - merged to `main` (`4967a40`)
   - CI + Deploy Cloudflare succeeded (`22236383073`, `22236383061`)
   - production refresh at `2026-02-20T18:45:14.219Z` picked up tuning profile.
32. Production impact summary:
   - curated items reduced to `214` (from `270`)
   - top 20 cards now fully politics/civic
   - curated `sports=0`, curated `entertainment=0`
   - no semantic failures observed during post-rollout monitoring.
33. Next tuning lane:
   - evaluate over 24h window, then decide whether to:
     - raise/decrease sports/entertainment floors
     - adjust baseline `COASENSUS_LLM_MIN_NEWS_SCORE`
     - increase `COASENSUS_LLM_MAX_MARKETS_PER_RUN` if cache misses grow.
34. Topic/event de-dup milestone (pass #1, staging):
   - added post-ranking de-dup pass in refresh pipeline to prevent same-story variant domination
   - dedup demotions are transparent via `excluded_topic_duplicate_of_<anchor_market_id>`
   - configurable via:
     - `COASENSUS_TOPIC_DEDUP_ENABLED`
     - `COASENSUS_TOPIC_DEDUP_SIMILARITY`
     - `COASENSUS_TOPIC_DEDUP_MIN_SHARED_TOKENS`
     - `COASENSUS_TOPIC_DEDUP_MAX_PER_CLUSTER`
35. Staging verification for de-dup pass:
   - deployed version `a5edbc64-8169-4e94-a10e-b667da8f3865`
   - refresh snapshot `2026-02-20T20:00:13.558Z` healthy (`llmAttempts=1`, `llmFailures=0`)
   - curated feed reduced to `84` items with `133` explicit dedup rejections
   - top-20 now includes geopolitics presence (`politics: 17`, `geopolitics: 3`).
36. Queue hygiene:
   - added `docs/ROADMAP_QUEUE.md` to track `Now / Next / Later` milestones and avoid losing deferred work while moving fast.
37. Recommended next action:
   - if staging looks good for 1-2 additional refresh cycles, promote this branch to `main` and verify production composition.
38. Production verification after de-dup promotion:
   - monitor run `22239669070` => success
   - latest production refresh snapshot: `runId 2026-02-20T20-15-11-010Z`
   - production curated feed count settled at `83` with healthy staleness window.
39. Search milestone pass #1 (`MILESTONE-UI-SEARCH-002`):
   - added API query filter `q` (also accepts alias `search`) on `question` + `description`
   - added web control (`Search`) and query wiring to include `q` in feed requests
   - updated analytics payloads and feed meta chips to include active search state.
40. Validation for search milestone:
   - `npm run check` => success
   - web unit tests updated for query-string builder search behavior.
41. Next recommended milestone:
   - implement `MILESTONE-REGION-003` (expose `geo_tag`, add region filter in API/UI, then tune category x region composition).
42. Search milestone promotion complete:
   - merged to `main` as `a9b29ed`
   - CI + Deploy Cloudflare green (`22239925428`, `22239925419`).
43. Post-deploy verification:
   - production and staging search smoke checks (`q=election`) both return non-zero items and `meta.searchQuery="election"`
   - manual monitor workflows succeeded:
     - production `22239978136`
     - staging `22239979666`
   - `/api/admin/semantic-metrics` remained healthy in both environments via monitor checks.
44. Region milestone implementation (`MILESTONE-REGION-003`) completed on `agent/region-filter-pass1`:
   - added migration `infra/db/migrations/0005_curated_feed_geo_tag.sql`
   - refresh pipeline now persists semantic region to `curated_feed.geo_tag`
   - API `/api/feed` adds `region` filter (alias `geoTag`) and returns `geoTag` in each item
   - web UI now includes region control and region badges on cards.
45. Local validation caveat in current sandbox:
   - typecheck + lint pass
   - full vitest runs fail due sandbox process spawn restriction (`spawn EPERM`)
   - local wrangler dry-run/deploy could not run because npm registry access for `wrangler` is blocked.
46. Next action after pushing:
   - rely on GitHub CI + Deploy Cloudflare to run remote validation and apply migration `0005`, then verify staging/prod feed smoke with `region=US`.
47. Region milestone promotion complete:
   - merged to `main` as `1c4f5de`
   - CI + Deploy Cloudflare succeeded (`22252557586`, `22252557594`).
48. Staging parity completed:
   - applied `0005_curated_feed_geo_tag.sql` to `coasensus-staging`
   - deployed staging worker version `6e2cb160-ec74-4168-8f36-6dae70276a4e`.
49. Region filter live verification:
   - production + staging `GET /api/feed?...&region=US` both return `regionFilterApplied=true` with `geoTag` populated.
50. Post-rollout monitors:
   - production monitor `22252721036` success
   - staging monitor `22252722052` success.
51. Next recommended milestone:
   - implement `MILESTONE-TREND-004` (trending-shift delta vs previous refresh + UI indicator).
52. Trend milestone implementation (`MILESTONE-TREND-004`) completed on `agent/trend-shift-pass1`:
   - added migration `infra/db/migrations/0006_curated_feed_trend_delta.sql`
   - refresh pipeline now computes and persists `trend_delta` for each market vs previous refresh snapshot
   - API `/api/feed` supports `sort=trend` and returns `trendDelta` per item
   - web UI includes `Trending up` sort and trend badges on cards.
53. Staging rollout for trend milestone:
   - applied `0006_curated_feed_trend_delta.sql` to `coasensus-staging`
   - deployed staging worker version `60ae8bdd-a633-4050-9f79-4a689f53aaec`
   - staging smoke for `sort=trend` is healthy with `trendSortAvailable=true`.
54. Validation status:
   - `npm run check` passed
   - worker dry-run deploy for staging passed.
55. Next recommended milestone:
   - implement `MILESTONE-ALERT-005` (explicit alerts for repeated semantic failures and stale feed).
56. Trend milestone promotion complete:
   - merged to `main` as `cc06189`
   - CI + Deploy Cloudflare succeeded (`22252881208`, `22252881209`).
57. Trend endpoint live verification:
   - production + staging `GET /api/feed?...&sort=trend` both return `trendSortAvailable=true` and `requestedSort=trend`.
58. Post-rollout monitor health:
   - production monitor `22252904455` success
   - staging monitor `22252905034` success.
59. Next recommended milestone:
   - implement `MILESTONE-ALERT-005` (alerting for stale feed / repeated semantic failures).
60. Alert milestone implementation (`MILESTONE-ALERT-005`) completed on `agent/alerting-pass1`:
   - monitor script now emits explicit alert-coded failures:
     - `[ALERT_EMPTY_FEED]` when feed returns zero items
     - `[ALERT_STALE_FEED]` when latest telemetry age exceeds threshold
     - `[ALERT_SEMANTIC_FAILURE_STREAK]` when `llmFailures > 0` across configured consecutive runs
   - added `COASENSUS_SEMANTIC_FAILURE_STREAK` env var (default `3`) and dynamic telemetry window fetch.
61. Monitor workflow updates:
   - `.github/workflows/monitor-production.yml` and `.github/workflows/monitor-staging.yml` now set:
     - `COASENSUS_SEMANTIC_FAILURE_STREAK=3`
   - existing stale threshold remains `COASENSUS_MAX_STALE_MINUTES=90`.
62. Next recommended milestone:
   - implement `MILESTONE-RATE-006` (per-session rate-limited analytics sampling).
63. Alert milestone promotion complete:
   - merged as `80da77b` (PR `#1`)
   - CI `22253096764` + Deploy Cloudflare `22253096757` succeeded on `main`.
64. Post-merge monitor confirmation:
   - production monitor `22253101327` success
   - staging monitor `22253101546` success.
65. Rate milestone implementation (`MILESTONE-RATE-006`) completed on `agent/rate-limit-pass1`:
   - web analytics sender now applies per-session sampling + cooldown policy before POSTing `/api/analytics`.
   - persisted session-local analytics counters in `localStorage` key `coasensus_analytics_state_v1`.
   - added global session cap (`ANALYTICS_MAX_EVENTS_PER_SESSION=160`) and event-level limits.
66. Sampling/rate policy highlights:
   - `feed_loaded`: sampled at `0.4`, min interval `60s`, max `24` per session.
   - `pagination_{next,previous}`: sampled at `0.5`, min interval `2s`, max `36` per session.
   - noisy toggle/search events now include short cooldowns (`~1.2s`) and per-session caps.
67. Validation:
   - `npm run check` passed after web analytics throttling updates.
68. Next recommended milestone:
   - implement `MILESTONE-TAXONOMY-007` (region/category distribution panel in admin diagnostics).
69. Rate milestone promotion complete:
   - merged as `6341f99` (PR `#2`)
   - CI `22253225521` + Deploy Cloudflare `22253225537` succeeded on `main`.
70. Post-merge monitor confirmation:
   - production monitor `22253244279` success
   - staging monitor `22253244294` success.
71. Taxonomy milestone implementation (`MILESTONE-TAXONOMY-007`) completed on `agent/taxonomy-pass1`:
   - `GET /api/admin/feed-diagnostics` now includes explicit taxonomy distribution payload:
     - `regionCounts`
     - `regionCategoryDistribution`
     - `taxonomyPanel` (`regions`, `categories`, `regionCategory`)
   - category and region rows now include normalized ratio fields for diagnostics:
     - `shareOfFeed`
     - `curatedShareWithinCategory` / `curatedShareWithinRegion`.
72. Backward compatibility behavior:
   - existing fields (`counts`, `categoryCounts`, `topDecisionReasons`, `topReasonCodes`) remain present.
   - when `geo_tag` is unavailable, diagnostics safely fall back to synthetic `World` region totals.
73. Validation:
   - `npm run check` passed after taxonomy diagnostics expansion.
74. Next recommended milestone:
   - implement `MILESTONE-PERF-008` (cached feed query path for high-traffic read bursts).
75. Taxonomy milestone promotion complete:
   - merged as `66aad5c` (PR `#3`)
   - CI `22253351976` + Deploy Cloudflare `22253351988` succeeded on `main`.
76. Post-merge monitor confirmation:
   - production monitor `22253372672` success
   - staging monitor `22253372673` success.
77. Perf milestone implementation (`MILESTONE-PERF-008`) completed on `agent/perf-pass1`:
   - added Worker Cache API path for `GET /api/feed` with canonicalized query cache keys.
   - cache policy is env-controlled:
     - `COASENSUS_FEED_CACHE_ENABLED` (default `1`)
     - `COASENSUS_FEED_CACHE_TTL_SECONDS` (default `45`)
   - optional client bypass for debugging: `?cache=0`.
78. Feed cache observability:
   - response header `X-Coasensus-Feed-Cache` now returns `HIT`, `MISS`, or `BYPASS`.
   - cache lookup/write failures are logged but do not fail feed reads.
79. Config parity updates:
   - added feed-cache vars to both `wrangler.api.jsonc` and `wrangler.api.ci.jsonc` (root + staging + production blocks) to prevent deploy drift.
80. Validation:
   - `npm run check` passed after feed cache implementation.
81. Next recommended milestone:
   - backlog complete for current queue; next work should be a new roadmap item or launch hardening pass.
82. Perf milestone promotion complete:
   - merged as `7063be1` (PR `#4`)
   - CI `22253480745` + Deploy Cloudflare `22253480746` succeeded on `main`.
83. Staging parity update for perf rollout:
   - staging Worker was manually deployed to include feed-cache logic:
     - version `a67ebce4-819f-4cf0-af00-33f099cbc0b1`.
84. Cache behavior verification:
   - production + staging `GET /api/feed?...` now return `X-Coasensus-Feed-Cache` with `HIT|MISS`, and `?cache=0` returns `BYPASS`.
85. Post-rollout monitor confirmation:
   - production monitor `22253534691` success
   - staging monitor `22253534717` success.
86. Execution-plan status sync completed:
   - `docs/EXECUTION_PLAN_V2.md` checklist now reflects shipped work and remaining optional/post-launch items.
87. New planning artifact added:
   - `docs/POST_V2_BACKLOG.md` defines post-V2 milestone order + acceptance criteria.
88. Queue reopened after V2 completion:
   - `docs/ROADMAP_QUEUE.md` now sets `MILESTONE-LAUNCH-STABILITY-009` as active.
   - next queued: `MILESTONE-CATEGORY-SANITY-010`, `MILESTONE-EDITORIAL-SPOTCHECK-011`, `MILESTONE-DASHBOARD-012`.
89. Execution-plan/backlog sync promotion complete:
   - pushed as `bd3de29`
   - CI `22253859338` + Deploy Cloudflare `22253859341` succeeded on `main`.
90. Post-sync monitor confirmation:
   - production monitor `22253876652` success
   - staging monitor `22253876653` success.
91. Launch-stability milestone implementation (`MILESTONE-LAUNCH-STABILITY-009`) completed on `agent/launch-stability-pass1`:
   - added script `scripts/launch-stability.mjs` to compute 24h readiness from monitor workflow history.
   - output artifacts:
     - `artifacts/launch-status.json`
     - `artifacts/launch-status.md`
   - workflow returns non-zero when gate criteria are not met.
92. New workflow added:
   - `.github/workflows/launch-stability.yml`
   - schedule: hourly (`17 * * * *`) + manual dispatch.
   - uploads launch-status artifacts even when readiness fails.
93. Launch-stability checks include:
   - run count floors (prod/staging), failure threshold, empty-hour threshold, max run-gap threshold.
   - per-hour pass/fail rollup to show stability coverage across window.
94. Launch docs/queue updates:
   - `docs/LAUNCH_GATES.md` now includes Launch Stability workflow in go-live checklist.
   - `docs/ROADMAP_QUEUE.md` marks `MILESTONE-LAUNCH-STABILITY-009` complete and promotes `MILESTONE-CATEGORY-SANITY-010`.
95. Validation:
   - `npm run check` passed.
   - local script success-path validated with short-window env overrides.
   - note: strict 24h window currently reports `overallReady=false` due historical failure/gaps, which is expected until the next clean stability window.
96. Launch-stability milestone promotion:
   - merged PR `#5` to `main` as commit `a58c7ad`.
97. Post-merge pipeline status:
   - CI `22254044518` success.
   - Deploy Cloudflare `22254044521` success.
98. Manual monitor verification on `main`:
   - production monitor `22254064611` success.
   - staging monitor `22254064637` success.
   - monitor checks confirm `/api/admin/semantic-metrics` returned success responses in both environments.
99. Launch Stability execution snapshot:
   - manual run `22254064721` executed and returned `overallReady=false` (expected strict gate behavior on historical data).
   - production reasons: run-count floor miss, 1 historical failure, empty-hour gaps, max-gap breach.
   - staging reasons: 1 historical failure, empty-hour gaps, max-gap breach.
   - artifact bundle uploaded: `launch-stability-22254064721` (`launch-status.json`, `launch-status.md`).
100. Started `MILESTONE-CATEGORY-SANITY-010` on branch `agent/category-sanity-pass1`.
101. Added top-N category composition metrics to admin diagnostics:
   - `GET /api/admin/feed-diagnostics?topN=20` now returns `topPageComposition` with:
     - `topNRequested`
     - `topNEvaluated`
     - per-category `shareOfTopN`
     - `dominantCategory`
     - score formula metadata.
102. Added monitor category-dominance alerting:
   - `scripts/monitor-production.mjs` now queries `/api/admin/feed-diagnostics` and evaluates top-page concentration.
   - new alert code: `ALERT_CATEGORY_DOMINANCE`.
   - configurable env vars:
     - `COASENSUS_CATEGORY_DOMINANCE_TOP_N`
     - `COASENSUS_CATEGORY_DOMINANCE_MAX_SHARE`.
103. Workflow wiring updated:
   - `.github/workflows/monitor-production.yml` and `.github/workflows/monitor-staging.yml` now pass category-dominance env vars.
104. Validation (local):
   - `npm run check` passed after category-sanity implementation.
105. Queue/checklist updates:
   - `docs/ROADMAP_QUEUE.md` marks `MILESTONE-CATEGORY-SANITY-010` complete and promotes `MILESTONE-EDITORIAL-SPOTCHECK-011`.
   - `docs/ISSUE_CHECKLIST.md` adds `QA-011` completed.

## How to start a fresh Codex session
1. Open terminal in repo: `E:\Coasensus Predictive future`
2. Ensure branch is up to date:
   - `git checkout main`
   - `git pull`
3. Start a new branch for the task:
   - `git checkout -b agent/<task-name>`
4. Give the new session the prompt template below.

## Copy-paste prompt template
```text
Continue Coasensus from commit <commit-hash>.

Read first:
- 00_START_HERE.md
- README.md
- docs/HANDOFF.md
- docs/PROGRESS_LOG.md
- docs/ISSUE_CHECKLIST.md

Do not redo completed work.
Current target:
- <task-id>: <task-description>

After implementation:
1) Run validation commands
2) Update docs/PROGRESS_LOG.md and docs/ISSUE_CHECKLIST.md
3) Commit with a clear message
4) Push to origin
```

## Update rule
After every meaningful milestone:
1. Update `docs/HANDOFF.md` checkpoint section.
2. Update `docs/PROGRESS_LOG.md`.
3. Update `docs/ISSUE_CHECKLIST.md`.
4. Commit and push.
