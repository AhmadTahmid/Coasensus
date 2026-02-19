# Ingest Worker

Responsible for pulling active Polymarket markets, handling retries, and normalizing raw payloads into canonical market records.

## Commands
- `npm run --workspace @coasensus/ingest-worker test`
- `npm run --workspace @coasensus/ingest-worker smoke`

## Smoke-test environment knobs
- `POLYMARKET_LIMIT_PER_PAGE` (default: `50`)
- `POLYMARKET_MAX_PAGES` (default: `2`)
- `POLYMARKET_RETRIES` (default: `2`)
- `POLYMARKET_TIMEOUT_MS` (default: `12000`)
