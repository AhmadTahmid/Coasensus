# Deploy Verification Checklist

Use this checklist after every staging or production deploy.

## Scope
1. API Worker deploy health
2. Web Pages deploy health
3. Feed/data freshness health
4. Admin auth path health
5. Rollback readiness

## Inputs
1. `BASE_URL`
   - Staging: `https://staging.coasensus.com`
   - Production: `https://coasensus.com`
2. `ADMIN_TOKEN`
   - Value from `COASENSUS_ADMIN_REFRESH_TOKEN`
3. `MAX_STALE_MINUTES`
   - Default: `90`

## Step 1: API health
```bash
curl -sS "$BASE_URL/api/health"
```
Pass criteria:
1. HTTP `200`
2. JSON includes `"status":"ok"`

## Step 2: Feed smoke
```bash
curl -sS "$BASE_URL/api/feed?page=1&pageSize=3&sort=score"
```
Pass criteria:
1. HTTP `200`
2. `meta.totalItems > 0`
3. `items.length > 0`
4. `meta.scoreFormula == "front_page_score_v1"`

## Step 3: Admin auth path
Without token:
```bash
curl -i -sS "$BASE_URL/api/admin/semantic-metrics?limit=1"
```
Pass criteria:
1. HTTP `401`

With token:
```bash
curl -sS -H "X-Admin-Token: $ADMIN_TOKEN" "$BASE_URL/api/admin/semantic-metrics?limit=1"
```
Pass criteria:
1. HTTP `200`
2. `runs[0]` exists

## Step 4: Freshness gate
Use monitor script:
```bash
COASENSUS_BASE_URL="$BASE_URL" \
COASENSUS_ADMIN_TOKEN="$ADMIN_TOKEN" \
COASENSUS_MAX_STALE_MINUTES="$MAX_STALE_MINUTES" \
node scripts/monitor-production.mjs
```
Pass criteria:
1. Script exits `0`
2. `staleMinutes <= MAX_STALE_MINUTES`

## Step 5: Deployment metadata capture
Record in `docs/PROGRESS_LOG.md`:
1. Deploy timestamp (UTC)
2. Commit SHA
3. Worker version/deploy id
4. Pages deploy id
5. Smoke-check outputs (health/feed/admin/freshness)

## Rollback trigger
Rollback immediately if any of the following is true:
1. `/api/health` returns non-`200`
2. `/api/feed` returns empty for 2 checks spaced 5 minutes apart
3. Admin endpoint returns `5xx`
4. Freshness monitor fails for 2 consecutive intervals

## Rollback actions
1. Redeploy last known good Worker version.
2. Redeploy last known good Pages build.
3. Re-run Step 1-4 checks.
4. Log rollback reason and affected SHA in `docs/PROGRESS_LOG.md`.
