# Coasensus Project Execution Plan

## 1. Product Goal
- Build a public feed of **active Polymarket markets** filtered to emphasize **civic impact + news relevance**.
- Remove low-signal meme/novelty markets.
- Present results in a clean card/feed UI similar to prediction-market browsing patterns.
- Deploy production to `coasensus.com`.

## 2. MVP Scope (Move Fast, Then Improve)
- Ingest active markets on a schedule.
- Classify each market with a rules-first filter (fast + explainable).
- Store filtered results in a database.
- Expose a read API for feed/cards.
- Build a responsive web frontend showing:
  - card view
  - sort by relevance / latest activity
  - category badges (Politics, Economy, Policy, Geopolitics, Public Health, etc.)
- Add basic observability (logs, ingestion success metrics).

## 3. Suggested Architecture (Fast to Ship)
- `worker-ingest`: scheduled job fetches active Polymarket markets.
- `worker-filter`: runs elimination/scoring pipeline and writes curated results.
- `api`: serves curated markets (with pagination/sorting/filter params).
- `web`: Next.js frontend for feed/cards.
- `db`: Postgres (or Cloudflare D1 if you want a full-Cloudflare stack).

### Recommended Initial Stack
- Frontend: Next.js + TypeScript + Tailwind
- API: Next.js route handlers or lightweight Worker API
- Scheduler: cron-triggered worker (or GitHub Actions cron in early MVP)
- DB: Postgres + Prisma
- Deploy: Cloudflare (Pages + Worker) with domain `coasensus.com`

## 4. Repository Layout
```text
coasensus/
  apps/
    web/                  # Next.js UI
  services/
    ingest-worker/        # pulls active Polymarket markets
    filter-engine/        # filtering/scoring module + tests
  packages/
    shared-types/         # schemas/types
    shared-utils/         # common helpers
  infra/
    cloudflare/           # wrangler configs, deploy scripts
    db/                   # schema/migrations/seed
  docs/
    decisions/            # ADRs
  COASENSUS_EXECUTION_PLAN.md
```

## 5. Multi-Agent Orchestration Model
Use one orchestrator + specialist agents in parallel. Each agent works on a separate branch and fixed file ownership to avoid merge conflicts.

### Roles
- Agent 0 (Orchestrator): planning, issue breakdown, integration, release decisions.
- Agent 1 (Platform): monorepo scaffold, CI, lint/test, shared types.
- Agent 2 (Ingest): Polymarket ingestion client + scheduler + retries.
- Agent 3 (Filter): civic/newsworthy scoring + elimination rules + tests.
- Agent 4 (Web): UI feed/cards + API integration + loading/error states.
- Agent 5 (Infra/Deploy): cloud deployment, domain setup, env secrets.
- Agent 6 (QA/Observability): test matrix, synthetic checks, logging dashboards.

### Branching Convention
- `main` (protected)
- `agent/platform-foundation`
- `agent/ingest-pipeline`
- `agent/filter-engine`
- `agent/web-feed-ui`
- `agent/infra-deploy`
- `agent/qa-observability`

### Ownership Rules
- Shared contracts (`packages/shared-types`) merged first.
- Each agent edits only owned directories unless orchestrator approves cross-cut.
- Integration happens in dependency order (see section 7).

## 6. Work Breakdown by Chunk

### Chunk A: Foundation (Agent 1)
Deliverables:
- Monorepo initialized.
- TypeScript strict mode.
- ESLint + Prettier + test runner.
- Base CI workflow.
- Shared type definitions for `Market`, `FilteredMarket`, `Category`.
Definition of done:
- Clean install, lint, typecheck, test in CI.

### Chunk B: Ingestion (Agent 2)
Deliverables:
- Polymarket client module for active markets.
- Normalizer that maps raw fields to canonical `Market` schema.
- Retry + backoff + error logging.
- Persist raw + normalized records.
Definition of done:
- Scheduled run succeeds repeatedly and logs counts.

### Chunk C: Filter/Ranking Engine (Agent 3)
Deliverables:
- Elimination rules (meme/sports/low-signal patterns).
- Civic-impact classifier (keyword + taxonomy + source/tag heuristics).
- Newsworthiness score (`liquidity`, `volume`, `open_interest`, recency).
- Explainability payload (why market was included/excluded).
Definition of done:
- Test suite with representative fixtures; precision-focused behavior on known examples.

### Chunk D: Feed API + UI (Agent 4)
Deliverables:
- API endpoint: paginated curated feed.
- Card components + feed page.
- Sort/filter controls.
- Empty/loading/error states.
- Mobile + desktop responsive layout.
Definition of done:
- UI works against staging data without manual patching.

### Chunk E: Deploy + Domain (Agent 5)
Deliverables:
- Cloudflare project setup.
- Environment variable and secret management.
- Production deploy pipeline.
- DNS wiring for `coasensus.com`.
- HTTPS + caching.
Definition of done:
- Public URL on `coasensus.com` serving live curated feed.

### Chunk F: QA + Observability (Agent 6)
Deliverables:
- End-to-end smoke tests.
- Ingestion/filter health checks.
- Alerting for job failures and stale feed.
- Basic analytics events (page view, card click).
Definition of done:
- Failures are visible quickly; baseline uptime confidence.

## 7. Dependency Graph and Merge Order
1. Foundation (A)
2. Ingestion (B) and Filter Engine (C) in parallel after A
3. API/UI (D) after A + provisional contracts from B/C
4. Deploy (E) after D stable on staging
5. QA/Observability (F) starts early, finalizes after D/E

Practical merge sequence:
1. `agent/platform-foundation` -> `main`
2. `agent/ingest-pipeline` + `agent/filter-engine` -> `integration/data`
3. `agent/web-feed-ui` rebased on `integration/data`
4. `integration/data` + `agent/web-feed-ui` -> `main`
5. `agent/infra-deploy` -> `main`
6. `agent/qa-observability` -> `main`

## 8. Filter Logic (MVP Heuristic Strategy)
Start simple and explainable before ML.

### Step 1: Hard Exclusion
- Exclude obvious meme/novelty patterns via tags + regex.
- Exclude categories outside civic/news intent (sports, celebrity gossip, pure meme coins, etc.).

### Step 2: Civic Relevance Scoring
- Positive taxonomy match:
  - elections/governance
  - policy/law/regulation
  - macroeconomy/markets
  - geopolitics/conflict
  - public health/climate/energy
- Score boosts:
  - higher liquidity/volume/open interest
  - close resolution windows (active news cycle)
  - stronger source metadata quality (if available)

### Step 3: Keep/Drop Decision
- Keep if:
  - not excluded
  - civic score >= threshold
  - newsworthiness >= threshold
- Store rationale:
  - `decision_reason`: `excluded_meme_tag`, `included_policy_relevance`, etc.

### Step 4: Human Calibration Loop
- Weekly review of false positives/negatives.
- Tune rules + thresholds using labeled examples.

## 9. Data Model (Minimal)
- `markets_raw`: raw ingestion payload + timestamp
- `markets_normalized`: canonical market fields
- `market_scores`: score components + decision reason
- `curated_feed`: denormalized read model for fast UI reads

Core fields:
- `market_id`
- `question`
- `description`
- `url`
- `end_date`
- `liquidity`
- `volume`
- `open_interest`
- `category`
- `civic_score`
- `newsworthiness_score`
- `is_curated`
- `decision_reason`
- `last_updated_at`

## 10. Operating Rhythm (How You Run Multiple Codex Instances)
1. Orchestrator creates issues/chunks and acceptance criteria.
2. Each Codex session is launched in separate terminal on assigned branch.
3. Each agent works only in owned folders and pushes small PRs.
4. Orchestrator merges in dependency order and resolves contract drift quickly.
5. Daily integration window:
  - morning: sync contracts
  - afternoon: merge/test
  - evening: deploy staging

## 11. Suggested Prompt Templates Per Agent

### Platform Agent Prompt
```text
Set up monorepo foundation with TypeScript strict mode, lint/test CI, shared schemas for Market and CuratedMarket. Keep it production-ready and minimal.
```

### Ingestion Agent Prompt
```text
Implement scheduled ingestion for active Polymarket markets with retries, normalization, and DB persistence. Add unit tests for normalizer edge cases.
```

### Filter Agent Prompt
```text
Create a deterministic filtering/scoring engine to remove meme markets and rank civic/newsworthy markets. Include explainable decision reasons and tests.
```

### Web Agent Prompt
```text
Build a responsive feed/cards UI backed by curated API with sorting, loading, and error states. Optimize for scannability and mobile first.
```

### Infra Agent Prompt
```text
Deploy app to Cloudflare and configure coasensus.com with HTTPS, DNS records, environment secrets, and deployment docs.
```

## 12. Milestone Timeline (Aggressive but Realistic)
- Day 1: Foundation scaffold + schema contracts
- Day 2-3: Ingestion + filter v1 in staging
- Day 4: Feed UI wired to staging API
- Day 5: Deploy pipeline + domain setup
- Day 6: QA hardening + threshold tuning
- Day 7: MVP launch at `coasensus.com`

## 13. Risks and Mitigations
- API changes/rate limits:
  - Mitigation: adapter layer + retries + caching + fallback snapshots.
- Weak filter quality initially:
  - Mitigation: explainable scoring + fast calibration loop.
- Merge conflicts from many agents:
  - Mitigation: strict folder ownership + short-lived branches + daily integration.
- Deployment drift:
  - Mitigation: infra-as-code + env checklist + staging gate before prod.

## 14. Launch Criteria (MVP)
- Ingestion runs successfully on schedule.
- Feed updates automatically.
- Meme/noise rate reduced to acceptable level (manual QA sample).
- Site is fast and stable on desktop/mobile.
- `coasensus.com` serves HTTPS production feed.

## 15. Immediate Next Actions
1. Initialize monorepo + CI (Chunk A).
2. Lock schema contracts for `Market` and `CuratedFeedItem`.
3. Start Chunk B + C in parallel.
4. Build thin UI shell immediately with mocked data while B/C run.
5. Integrate, stage, then domain deploy.
