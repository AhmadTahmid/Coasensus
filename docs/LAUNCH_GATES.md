# Launch Gate Criteria

This document defines go/no-go criteria for public launch decisions.

## Launch decision model
1. Every gate must be `PASS` or explicitly accepted as a temporary exception.
2. Exceptions require a dated note in `docs/PROGRESS_LOG.md` with owner + expiry.
3. If any P0 gate fails and has no approved exception, launch is `NO-GO`.

## P0 gates (required)
1. API availability
   - Check: `GET /api/health`
   - Requirement: `200` + `status=ok` in both staging and production
2. Feed availability
   - Check: `GET /api/feed?page=1&pageSize=3&sort=score`
   - Requirement: `meta.totalItems > 0` and non-empty `items`
3. Freshness
   - Check: monitor script + monitor workflow
   - Requirement: latest refresh age `<= 90` minutes
4. Auth protection
   - Check: `GET /api/admin/semantic-metrics?limit=1` without token
   - Requirement: returns `401`
5. Semantic pipeline health
   - Check: latest semantic telemetry run
   - Requirement: if `llmEnabled=true`, `llmAttempts > 0` and `llmSuccessRate >= 0.70`
6. Deploy safety
   - Check: rollback path documented and last good SHA known
   - Requirement: `docs/DEPLOY_VERIFICATION_CHECKLIST.md` executed and logged

## P1 gates (strong recommendation)
1. Quality stability window
   - Requirement: monitor workflow passes for at least 24 hours before launch announcement
2. Category sanity
   - Requirement: top feed page is not dominated by sports/entertainment-only items; civic/world/politics/economy present
3. Manual editorial spot check
   - Requirement: review top 20 cards; no obvious meme/noise leakage
4. Error budget
   - Requirement: no unresolved P0 incidents in prior 24 hours

## Ongoing operating thresholds (post-launch)
1. Freshness alert: `staleMinutes > 90`
2. Data alert: `meta.totalItems == 0`
3. Semantic alert: `llmFailures > 0` for 3 consecutive runs
4. Reliability alert: monitor workflow fails twice in a row

## Go-live checklist
1. Run `docs/DEPLOY_VERIFICATION_CHECKLIST.md` for staging and production.
2. Confirm latest monitor run is green.
3. Confirm DNS and HTTPS for:
   - `https://coasensus.com`
   - `https://staging.coasensus.com`
4. Log launch decision + timestamp + responsible owner in `docs/PROGRESS_LOG.md`.
