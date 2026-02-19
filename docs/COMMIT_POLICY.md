# Commit Policy

## Rule of thumb
Commit every meaningful milestone, not every tiny command.

## Good commit moments
1. New scaffold that runs.
2. Contract changes in shared types.
3. Working ingestion step.
4. New passing tests.
5. Deploy pipeline changes.
6. Bug fix with reproduction + test.

## Commit message format
`<type>: <short summary>`

Examples:
1. `chore: initialize monorepo scaffold and docs`
2. `feat: add polymarket ingestion normalizer`
3. `feat: add civic relevance scoring engine`
4. `fix: prevent stale feed entries from rendering`
5. `ci: add workspace typecheck in github actions`

## PR checklist
1. Scope is small and focused.
2. Tests updated or rationale provided.
3. No unrelated files changed.
4. Docs updated when behavior changes.

