# Ingest Worker

Responsible for pulling active Polymarket markets, handling retries, and normalizing raw payloads into canonical market records.

## Commands
- `npm run --workspace @coasensus/ingest-worker test`
- `npm run --workspace @coasensus/ingest-worker smoke`
- `npm run --workspace @coasensus/ingest-worker api`

## Local feed API
After running smoke ingestion at least once, start API:
- `npm run dev:feed-api`

Routes:
- `GET /health`
- `GET /feed?page=1&pageSize=20&sort=score`
- `GET /feed?page=1&pageSize=20&sort=volume`
- `GET /feed?page=1&pageSize=20&sort=endDate&category=policy`
- `POST /analytics` (ingest web analytics event)
- `GET /analytics?limit=50` (recent analytics events)

Storage mode options:
- `FEED_STORAGE_MODE=json` (default, reads `infra/db/local/latest/normalized.json`)
- `FEED_STORAGE_MODE=sqlite` (reads latest run from SQLite DB)
- `FEED_ANALYTICS_DB_PATH` (optional analytics SQLite DB path override)

## Smoke-test environment knobs
- `POLYMARKET_LIMIT_PER_PAGE` (default: `50`)
- `POLYMARKET_MAX_PAGES` (default: `2`)
- `POLYMARKET_RETRIES` (default: `2`)
- `POLYMARKET_TIMEOUT_MS` (default: `12000`)
- `INGEST_OUTPUT_DIR` (default: `infra/db/local`)
- `INGEST_PERSIST` (default: `1`; set `0` to skip disk writes)
- `INGEST_PERSIST_JSON` (default: `1`)
- `INGEST_PERSIST_SQLITE` (default: `1`)
- `INGEST_SQLITE_DB_PATH` (default: `infra/db/coasensus.sqlite`)

Smart Firehose (foundation pass):
- `INGEST_USE_SMART_FIREHOSE` (default: `0`; set `1` to enable market-channel client)
- `INGEST_FIREHOSE_WS_URL` (default: `wss://ws-subscriptions-clob.polymarket.com/ws/market`)
- `INGEST_FIREHOSE_STALENESS_MS` (default: `90000`)
- `INGEST_FIREHOSE_RECONNECT_BASE_MS` (default: `800`)
- `INGEST_FIREHOSE_RECONNECT_MAX_MS` (default: `15000`)
- `INGEST_FIREHOSE_WARMUP_MS` (default: `4000`)
- `INGEST_FIREHOSE_SUBSCRIPTION_JSON` (optional JSON object to send on socket open)

When Smart Firehose is enabled, ingestion uses websocket snapshot data if it is fresh; otherwise it falls back to REST fetch automatically.

## Persistence outputs
Each persisted run writes:
- `infra/db/local/snapshots/<run-id>.json`
- `infra/db/local/raw/<run-id>.json`
- `infra/db/local/normalized/<run-id>.json`
- `infra/db/local/latest/snapshot.json`
- `infra/db/local/latest/raw.json`
- `infra/db/local/latest/normalized.json`

SQLite persistence also writes:
- `infra/db/coasensus.sqlite` (default path)
- tables: `ingestion_runs`, `latest_state`, `markets_raw`, `markets_normalized`
