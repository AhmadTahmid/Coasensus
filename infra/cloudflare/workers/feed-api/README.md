# Feed API Worker

Cloudflare Worker API for Coasensus.

## Routes
1. `GET /api/health`
2. `GET /api/feed?page=1&pageSize=20&sort=score`
3. `POST /api/admin/refresh-feed` (manual ingestion refresh; requires `X-Admin-Token` if `COASENSUS_ADMIN_REFRESH_TOKEN` secret is set)
4. `POST /api/analytics`
5. `GET /api/analytics?limit=50`

## Data source
Reads from D1 tables:
1. `curated_feed`
2. `analytics_events`
3. `ingestion_runs`
4. `latest_state`

## Refresh behavior
1. `GET /api/feed` auto-triggers a refresh if `curated_feed` is empty (controlled by `COASENSUS_AUTO_REFRESH_ON_EMPTY`).
2. Cron-based scheduled refreshes are configured in `wrangler.api.jsonc`.

## Local dev (Wrangler)
Run from repo root:

```bash
npx wrangler dev --config infra/cloudflare/wrangler.api.jsonc --env staging
```

Then test:

```bash
curl "http://127.0.0.1:8787/api/health"
curl "http://127.0.0.1:8787/api/feed?page=1&pageSize=20&sort=score"
```
