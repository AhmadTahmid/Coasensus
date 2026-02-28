# Feed API Worker

Cloudflare Worker API for Coasensus.

## Routes
1. `GET /api/health`
2. `GET /api/feed?page=1&pageSize=20&sort=trend&q=election&region=US`
3. `POST /api/admin/refresh-feed` (manual ingestion refresh; requires `X-Admin-Token` if `COASENSUS_ADMIN_REFRESH_TOKEN` secret is set)
4. `GET /api/admin/semantic-metrics?limit=30` (admin-protected telemetry snapshot)
5. `GET /api/admin/feed-diagnostics?topN=20` (admin-protected feed diagnostics + taxonomy panel + top-page category composition)
6. `POST /api/analytics`
7. `GET /api/analytics?limit=50`

## Data source
Reads from D1 tables:
1. `curated_feed`
2. `analytics_events`
3. `ingestion_runs`
4. `latest_state`
5. `semantic_market_cache` (LLM/editor output cache)
6. `semantic_refresh_runs` (refresh telemetry history)

## Refresh behavior
1. `GET /api/feed` auto-triggers a refresh if `curated_feed` is empty (controlled by `COASENSUS_AUTO_REFRESH_ON_EMPTY`).
2. Cron-based scheduled refreshes are configured in `wrangler.api.jsonc`.
3. Bouncer pre-filter runs before semantic/classification and is controlled by:
   - `COASENSUS_BOUNCER_MIN_VOLUME`
   - `COASENSUS_BOUNCER_MIN_LIQUIDITY`
   - `COASENSUS_BOUNCER_MIN_HOURS_TO_END`
   - `COASENSUS_BOUNCER_MAX_MARKET_AGE_DAYS`
4. Optional Smart Firehose overlay (worker-side, best-effort):
   - keeps REST ingest as the source of truth, then applies short websocket price updates during refresh warmup.
   - automatically falls back to REST-only when websocket is unavailable or yields no updates.
   - controls:
     - `COASENSUS_SMART_FIREHOSE_ENABLED` (`0` default)
     - `COASENSUS_SMART_FIREHOSE_WS_URL` (default `wss://ws-subscriptions-clob.polymarket.com/ws/market`)
     - `COASENSUS_SMART_FIREHOSE_WARMUP_MS` (default `2000`)
     - `COASENSUS_SMART_FIREHOSE_MAX_MESSAGES` (default `120`)
5. LLM semantic layer is optional and disabled by default:
   - `COASENSUS_LLM_ENABLED=0` (enable with `1`)
   - `COASENSUS_LLM_PROVIDER` (`openai` or `gemini`, default `openai`)
   - `COASENSUS_LLM_MODEL` (default: `gpt-4o-mini`)
   - `COASENSUS_LLM_BASE_URL` (default: `https://api.openai.com/v1`)
   - `COASENSUS_LLM_PROMPT_VERSION`
   - `COASENSUS_LLM_MIN_NEWS_SCORE`
   - `COASENSUS_LLM_MAX_MARKETS_PER_RUN` (max LLM attempts per refresh run)
   - automatic failover controls (temporary heuristic-only cooldown after repeated LLM-failure runs):
     - `COASENSUS_LLM_FAILOVER_ENABLED` (`1` default)
     - `COASENSUS_LLM_FAILOVER_FAILURE_STREAK` (default `3`)
     - `COASENSUS_LLM_FAILOVER_COOLDOWN_RUNS` (default `4`)
   - Worker secret required: `COASENSUS_LLM_API_KEY`
   - For Gemini 2.5 Flash, set:
     - `COASENSUS_LLM_PROVIDER=gemini`
     - `COASENSUS_LLM_MODEL=gemini-2.5-flash`
     - `COASENSUS_LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta`
6. Front-page ranking formula weights (used for `sort=score`):
   - `COASENSUS_FRONTPAGE_W1` (LLM/news term)
   - `COASENSUS_FRONTPAGE_W2` (log-volume term)
   - `COASENSUS_FRONTPAGE_W3` (log-liquidity term)
   - `COASENSUS_FRONTPAGE_LAMBDA` (time-decay penalty per hour)
7. Feed-read burst cache (Worker Cache API):
   - `COASENSUS_FEED_CACHE_ENABLED` (`1` by default; set `0` to disable)
   - `COASENSUS_FEED_CACHE_TTL_SECONDS` (default `45`)
   - cache-bypass query: `GET /api/feed?...&cache=0`
   - response header indicates cache path: `X-Coasensus-Feed-Cache` (`HIT|MISS|BYPASS`)

## Local dev (Wrangler)
Run from repo root:

```bash
npx wrangler dev --config infra/cloudflare/wrangler.api.jsonc --env staging
```

Then test:

```bash
curl "http://127.0.0.1:8787/api/health"
curl "http://127.0.0.1:8787/api/feed?page=1&pageSize=20&sort=score"
curl "http://127.0.0.1:8787/api/feed?page=1&pageSize=20&sort=score&q=inflation"
curl "http://127.0.0.1:8787/api/feed?page=1&pageSize=20&sort=score&region=US"
curl "http://127.0.0.1:8787/api/feed?page=1&pageSize=20&sort=trend"
```
