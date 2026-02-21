# Post-V2 Backlog

This backlog starts after `MILESTONE-PERF-008` completion and focuses on launch hardening and operational maturity.

## Active

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

## Recently Completed

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

## Parking Lot (Promote Only When Needed)

- `MILESTONE-SEMANTIC-FAILOVER-013`: automatic temporary heuristic fallback on consecutive LLM failures.
- `MILESTONE-UI-POLISH-014`: masonry layout, richer news card anatomy, optional iconography.
- `MILESTONE-RANKING-TESTS-015`: dedicated ranking regression/edge-case test suite.
