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

## Current checkpoint
1. Last pushed commit on active execution branch: run `git log --oneline -n 1`
2. Repo: `https://github.com/AhmadTahmid/Coasensus`
3. Baseline branch: `main`
4. Active execution branch for new plan: `feat/execution-plan-v2`
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
13. Pending next milestone:
   - tune semantic thresholds and ranking weights using observed outcomes
   - increase LLM cap gradually if/when provider quota allows
   - decide whether to keep Gemini-only staging profile or fall back to heuristic-first when quota is tight

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
