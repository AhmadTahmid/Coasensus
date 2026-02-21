# Roadmap Queue

Lightweight tracker to keep momentum high while preserving deferred work.

## Rule

1. Keep one active milestone in progress.
2. Keep at most three queued milestones.
3. Re-check this file after each meaningful deploy.

## Now

- [x] `MILESTONE-DEDUP-001` Topic/event de-dup in feed curation (reduce same-story dominance)
- [x] `MILESTONE-UI-SEARCH-002` Add text search (question/description) on API + web controls.
- [x] `MILESTONE-REGION-003` Add region filter controls and expose geo tag in UI.
- [x] `MILESTONE-TREND-004` Add trending-shift metric (delta vs previous refresh) and card indicator.
- [x] `MILESTONE-ALERT-005` Add explicit alerts for repeated semantic failures and stale feed.
- [x] `MILESTONE-RATE-006` Add per-session rate-limited analytics sampling to reduce noisy events.
- [x] `MILESTONE-TAXONOMY-007` Add explicit region/category distribution panel to admin diagnostics.
- [x] `MILESTONE-PERF-008` Add cached feed query path for high-traffic read bursts.

## Next

- (none)

## Later

- (none)

## Notes

- Keep this queue strict: if a later item becomes urgent, move it into `Now` and explicitly demote current work.
