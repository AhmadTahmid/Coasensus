# Start Here (Noob-Friendly)

## What is already done
1. A full execution strategy exists in `COASENSUS_EXECUTION_PLAN.md`.
2. A monorepo skeleton is ready for multi-agent work.
3. Shared market data contracts are scaffolded.
4. Agent workflow docs and commit policy are written.

## What you do first
1. Open a terminal in this folder:
   - `E:\Coasensus Predictive future`
2. Run:
   - `npm install`
3. Initialize local git history (if not already initialized):
   - `git init`
4. Make sure git identity is set:
   - `git config --global user.name "Your Name"`
   - `git config --global user.email "you@example.com"`
5. First commit:
   - `git add -A`
   - `git commit -m "chore: initialize coasensus scaffold and execution docs"`

## How to run multiple Codex agents
1. Read `docs/ORCHESTRATION_PLAYBOOK.md`.
2. For each agent, open a new terminal tab.
3. In each terminal, run:
   - `git checkout main`
   - `git pull` (once remote is connected)
   - `git checkout -b agent/<workstream-name>`
4. Use prompts from `docs/AGENT_PROMPTS.md`.
5. Merge in the order from `docs/AGENT_BOARD.md`.

## If you want me to keep driving
1. I can set up the actual `apps/web` Next.js app.
2. I can scaffold Polymarket ingestion service.
3. I can scaffold filter engine with tests.
4. I can prepare Cloudflare deployment config next.

