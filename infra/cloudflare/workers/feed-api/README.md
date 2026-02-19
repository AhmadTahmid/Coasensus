# Feed API Worker

Cloudflare Worker API for Coasensus.

## Routes
1. `GET /api/health`
2. `GET /api/feed?page=1&pageSize=20&sort=score`
3. `POST /api/analytics`
4. `GET /api/analytics?limit=50`

## Data source
Reads from D1 tables:
1. `curated_feed`
2. `analytics_events`

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
