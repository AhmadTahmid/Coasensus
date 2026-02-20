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
