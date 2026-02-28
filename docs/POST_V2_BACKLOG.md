# Post-V2 Backlog

This backlog starts after `MILESTONE-PERF-008` completion and focuses on launch hardening and operational maturity.

## Active

### `MILESTONE-SMART-FIREHOSE-016` (Foundation Pass 1)
- Goal: shift ingest toward incremental market updates while preserving reliability.
- Scope:
  - Add a managed Polymarket market-channel WebSocket client with reconnect/backoff.
  - Maintain in-memory snapshot updated by socket messages.
  - Add staleness-aware REST fallback so ingest remains deterministic during socket gaps.
- Current status:
  - foundation implemented in `services/ingest-worker`; production Worker integration still pending follow-up.

## Recently Completed

### `MILESTONE-UI-POLISH-014`
- Goal: improve feed readability/scannability with stronger visual hierarchy.
- Scope:
  - Add masonry-style card flow for secondary stories.
  - Add richer card anatomy: signal stack, market ribbon, reason-code chips, compact iconography.
  - Preserve canonical Polymarket link behavior and bold odds/price emphasis.
- Acceptance:
  - Lead card remains prominent while secondary cards render in masonry columns on desktop.
  - Card metadata and decision signals are easier to scan without reducing feed density.

### `MILESTONE-RANKING-TESTS-015`
- Goal: prevent silent ranking regressions and unstable ordering behavior.
- Scope:
  - Add dedicated ranking regression suite for local feed sorting paths.
  - Lock deterministic tie-break rules for equal-score/equal-metric cases.
  - Cover edge cases for null metrics and out-of-range pagination.
- Acceptance:
  - CI runs ranking tests and fails on ordering regressions.
  - Sorting behavior is deterministic for ties (`id` fallback).

### `MILESTONE-SEMANTIC-FAILOVER-013`
- Goal: keep refresh pipeline resilient when LLM providers degrade temporarily.
- Scope:
  - Add D1-backed failover state for semantic classification runs.
  - Trigger temporary heuristic-only mode after configurable consecutive LLM-failure runs.
  - Expose failover state in admin semantic telemetry for visibility.
- Acceptance:
  - Repeated failure runs automatically suppress LLM attempts for a cooldown window.
  - Semantic telemetry remains available and shows failover state (`active`, streak/cooldown counters).

### `MILESTONE-LAUNCH-STABILITY-009`
- Goal: make launch readiness measurable from automation, not manual guesswork.
- Scope:
  - Track rolling 24-hour pass/fail state for production and staging monitor workflows.
  - Persist readiness status in repo-friendly output (json/markdown artifact).
  - Fail readiness when monitor failures exceed allowed threshold.
- Acceptance:
  - One command/script can report `ready|not-ready` for launch.
  - Output includes evidence (workflow run IDs, timestamps, pass ratio).

### `MILESTONE-CATEGORY-SANITY-010`
- Goal: detect feed dominance drift (for example sports/entertainment over-concentration).
- Scope:
  - Add top-page composition metrics to diagnostics.
  - Add monitor alert when configurable dominance threshold is exceeded.
- Acceptance:
  - Diagnostics expose composition ratios for top-N cards.
  - Alert signal appears in monitor output with clear reason code.

### `MILESTONE-EDITORIAL-SPOTCHECK-011`
- Goal: reduce manual friction for editorial review.
- Scope:
  - Snapshot top-20 feed cards on cadence.
  - Add simple reviewer log path (who reviewed, timestamp, notes).
- Acceptance:
  - Daily snapshots are generated and inspectable.
  - Review records can be attached to launch/no-go decisions.

### `MILESTONE-DASHBOARD-012`
- Goal: make diagnostics more accessible than raw API responses.
- Scope:
  - Create read-only admin dashboard view for key metrics:
    - feed freshness
    - semantic success/failure
    - taxonomy distribution
    - cache status
- Acceptance:
  - Dashboard loads from existing admin endpoints with token auth.
  - No write actions; diagnostics-only surface.

## Parking Lot (Promote Only When Needed)

- (none)
