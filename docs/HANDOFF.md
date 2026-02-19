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

## Current checkpoint
1. Last pushed commit: `41f26a9`
2. Repo: `https://github.com/AhmadTahmid/Coasensus`
3. Working branch: `main`
4. Core stack status:
   - Ingestion client: implemented
   - Local persistence: implemented (`infra/db/local`)
   - Feed API: implemented (`/health`, `/feed`)
   - Web UI cards: implemented (`apps/web`)

## Known environment caveats
1. Some sandbox contexts block process spawn for Vitest/Vite and `tsx`.
2. Some sandbox contexts block outbound network calls (live Polymarket fetch can fail).
3. If that happens, validate with:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run dev:feed-api` against existing local persisted data
   - `npm run dev:web`

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
