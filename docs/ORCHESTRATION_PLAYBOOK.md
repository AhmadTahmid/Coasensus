# Orchestration Playbook

## Objective
Run multiple Codex sessions in parallel with minimal merge pain and clear integration points.

## Team model
1. `Agent 0` Orchestrator
2. `Agent 1` Platform/Foundation
3. `Agent 2` Ingestion
4. `Agent 3` Filter Engine
5. `Agent 4` Web UI/API
6. `Agent 5` Infrastructure/Deploy
7. `Agent 6` QA/Observability

## Ground rules
1. One branch per agent.
2. One ownership zone per agent.
3. Small PRs with clear acceptance criteria.
4. Shared types are the first contract to stabilize.
5. Orchestrator merges only when checks pass.

## Ownership zones
1. `packages/shared-types` -> Agent 1 + Orchestrator
2. `services/ingest-worker` -> Agent 2
3. `services/filter-engine` -> Agent 3
4. `apps/web` -> Agent 4
5. `infra/cloudflare` and `infra/db` -> Agent 5
6. `docs/test-plan.md` and checks -> Agent 6

## Daily operating cycle
1. Contract sync (15 minutes)
2. Parallel build phase
3. Integration window
4. Smoke test
5. Staging deploy
6. Progress log + commit

## Branch commands
```powershell
git checkout main
git pull
git checkout -b agent/platform-foundation
```

## Conflict policy
1. If two agents need same file, orchestrator decides owner for this iteration.
2. If contract changes, create a short ADR in `docs/decisions`.
3. Rebase branches daily on `main`.

