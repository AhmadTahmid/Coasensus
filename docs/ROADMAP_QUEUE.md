# Roadmap Queue

Lightweight tracker to keep momentum high while preserving deferred work.

## Rule

1. Keep one active milestone in progress.
2. Keep at most three queued milestones.
3. Re-check this file after each meaningful deploy.

## Now

- [x] `MILESTONE-DEDUP-001` Topic/event de-dup in feed curation (reduce same-story dominance)
- [ ] `MILESTONE-UI-SEARCH-002` Add text search (question/description) on API + web controls.

## Next

- [ ] `MILESTONE-REGION-003` Add region filter controls and expose geo tag in UI.
- [ ] `MILESTONE-TREND-004` Add trending-shift metric (delta vs previous refresh) and card indicator.

## Later

- [ ] `MILESTONE-ALERT-005` Add explicit alerts for repeated semantic failures and stale feed.

## Notes

- Keep this queue strict: if a later item becomes urgent, move it into `Now` and explicitly demote current work.
