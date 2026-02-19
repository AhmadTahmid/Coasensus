# Database

This directory tracks database schema and migrations for local SQLite and Cloudflare D1.

## Current migration
1. `migrations/0001_initial_schema.sql`
   - ingestion tables (`ingestion_runs`, `latest_state`, `markets_raw`, `markets_normalized`)
   - feed read model (`curated_feed`)
   - web analytics table (`analytics_events`)

## Cloudflare D1 usage
From repo root:

```bash
# Staging
npx wrangler d1 migrations apply coasensus-staging --remote --config infra/cloudflare/wrangler.api.jsonc --env staging

# Production
npx wrangler d1 migrations apply coasensus-production --remote --config infra/cloudflare/wrangler.api.jsonc --env production
```

## Local SQLite
The existing local dev ingest API uses:
1. `infra/db/coasensus.sqlite`
2. JSON snapshots under `infra/db/local`
