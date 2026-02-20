# Coasensus Filter Algorithm (Current v1.5)

This document explains how Coasensus decides which Polymarket markets appear in the feed.

## 1. High-level objective

The feed should prioritize civic-impact and newsworthy markets, while filtering out meme/noise markets.

## 2. Pipeline overview

1. Fetch active markets from Polymarket (`/markets`).
2. Apply objective "bouncer" pre-filters (volume, liquidity, time bounds).
3. Normalize raw API payloads into a consistent market shape.
4. Enrich each market with semantic metadata:
   - cache lookup by `market_id + prompt_version + content fingerprint`
   - optional LLM classification for cache misses
   - heuristic fallback if LLM is disabled or fails
5. Combine semantic output + deterministic checks to classify markets as curated or rejected.
6. Persist full snapshot to D1 (`curated_feed`), including both curated and rejected rows.

## 3. Data ingestion scope

The refresh worker fetches only active, non-closed, non-archived markets.

Polymarket query flags:
- `active=true`
- `closed=false`
- `archived=false`

Pagination defaults:
- `limit=100` per page
- `maxPages=8`

So one refresh typically evaluates up to `800` markets.

Bouncer pre-filter defaults (before semantic scoring):
- `COASENSUS_BOUNCER_MIN_VOLUME=10000`
- `COASENSUS_BOUNCER_MIN_LIQUIDITY=5000`
- `COASENSUS_BOUNCER_MIN_HOURS_TO_END=2`
- `COASENSUS_BOUNCER_MAX_MARKET_AGE_DAYS=365`

Semantic layer defaults:
- `COASENSUS_LLM_ENABLED=0` (off by default)
- `COASENSUS_LLM_PROVIDER=openai` (`openai` or `gemini`)
- `COASENSUS_LLM_MODEL=gpt-4o-mini`
- `COASENSUS_LLM_PROMPT_VERSION=v1`
- `COASENSUS_LLM_MIN_NEWS_SCORE=55`
- `COASENSUS_LLM_MIN_NEWS_SCORE_SPORTS=72`
- `COASENSUS_LLM_MIN_NEWS_SCORE_ENTERTAINMENT=78`
- `COASENSUS_LLM_MAX_MARKETS_PER_RUN=150`

Note:
- `COASENSUS_LLM_MAX_MARKETS_PER_RUN` is an **attempt cap** (not success cap).
- If provider calls fail, remaining markets fall back to heuristic classification.
- Cache misses are prioritized for LLM by civic/market-signal strength (volume, liquidity, recency, category keywords), so capped LLM calls are spent on higher-impact candidates first.
- Markets matching strict meme tokens are short-circuited to heuristic classification and do not consume LLM budget.

Front-page ranking defaults:
- `COASENSUS_FRONTPAGE_W1=0.6`
- `COASENSUS_FRONTPAGE_W2=0.25`
- `COASENSUS_FRONTPAGE_W3=0.1`
- `COASENSUS_FRONTPAGE_LAMBDA=0.02`

Topic de-dup defaults:
- `COASENSUS_TOPIC_DEDUP_ENABLED=1`
- `COASENSUS_TOPIC_DEDUP_SIMILARITY=0.55`
- `COASENSUS_TOPIC_DEDUP_MIN_SHARED_TOKENS=5`
- `COASENSUS_TOPIC_DEDUP_MAX_PER_CLUSTER=1`

## 4. Canonical market fields

Each raw Polymarket record is normalized to:
- `id`
- `question`
- `description`
- `url`
- `endDate`
- `liquidity`
- `volume`
- `openInterest`
- `tags`
- `createdAt`
- `updatedAt`

Records missing required fields (for example no `id` or no `question`) are dropped during normalization.

## 5. Hard exclusions (immediate rejection)

If market text contains any exclusion token, it is rejected immediately with reason:
- `excluded_<token>`

Detection behavior:
- Case-insensitive
- Boundary-aware token matching (word/phrase boundaries)
- Uses `question + description + tags` corpus

Strict rejection tokens used at curation stage:
- `meme`, `doge`, `pepe`, `crypto memecoin`, `gossip`

Broader exclusion tokens are still used by heuristic semantic fallback to estimate meme risk when LLM is disabled/unavailable.

## 6. Category detection

If not hard-excluded, the algorithm assigns one category:
- `politics`
- `economy`
- `policy`
- `geopolitics`
- `public_health`
- `climate_energy`
- `tech_ai`
- `sports`
- `entertainment`
- `other`

Method:
1. Match category keywords against corpus.
2. Count keyword hits per category.
3. Pick the category with the highest hit count.
4. If no hits, category = `other`.

Category keywords:
- `politics`: election, vote, senate, house, president, prime minister
- `economy`: inflation, gdp, recession, unemployment, federal reserve, interest rate
- `policy`: bill, law, regulation, policy, court, supreme court
- `geopolitics`: war, conflict, ceasefire, sanction, nato, china, russia, taiwan
- `public_health`: pandemic, vaccine, cdc, outbreak, public health, hospital, epidemic
- `climate_energy`: climate, emissions, oil, gas, renewable, energy, carbon

## 7. Scoring criteria

### Civic score

Formula:
- If category is not `other`: `1 + matched_category_keywords_count`
- Else: `0`

This means category + multiple matching civic keywords increases score.

### Newsworthiness score

When semantic enrichment is enabled, newsworthiness primarily comes from semantic score:
- `newsworthinessScore` is normalized to `1..100`
- source is one of: `cache`, `llm`, `heuristic`

When LLM is disabled or unavailable, heuristic fallback uses deterministic volume/liquidity/time signals and maps them into `1..100`.

## 8. Inclusion vs rejection

A market is **curated** only if all are true:
1. Not strict hard-excluded.
2. Not flagged as meme by semantic layer (`isMeme=false`).
3. `civicScore >= 2`
4. `newsworthinessScore >= COASENSUS_LLM_MIN_NEWS_SCORE` (default `55`)
5. Category-specific floor is applied on top of baseline:
   - `sports`: `max(COASENSUS_LLM_MIN_NEWS_SCORE, COASENSUS_LLM_MIN_NEWS_SCORE_SPORTS)`
   - `entertainment`: `max(COASENSUS_LLM_MIN_NEWS_SCORE, COASENSUS_LLM_MIN_NEWS_SCORE_ENTERTAINMENT)`

Otherwise it is **rejected**.

Main rejection reasons:
- `excluded_<token>` (hard exclusion)
- `excluded_llm_meme` (semantic layer flagged as meme)
- `excluded_semantic_below_civic_threshold` (did not meet civic threshold)
- `excluded_semantic_news_threshold_<category>` (did not meet baseline/category news threshold)

## 9. What is a "rejected market"?

A rejected market is still ingested and stored, but excluded from the default feed view.

Important:
- Rejected markets are available via API with `includeRejected=1`.
- This makes the system transparent and debuggable (you can inspect why it was filtered out).

## 10. Feed ranking and ordering

Default feed sorting (`sort=score`):
- Compute:
  - `Front Page Score = (w1 * S_LLM) + (w2 * log(V + 1)) + (w3 * log(L + 1)) - (lambda * delta_t)`
  - `S_LLM = newsworthinessScore / 100` (normalized 0..1)
  - `V = volume`
  - `L = liquidity`
  - `delta_t = hours since market updatedAt` (fallback: `createdAt`)
- Order by `front_page_score DESC`
- Tie-breaker: `market_id ASC`

Other supported sorts:
- `sort=volume`
- `sort=liquidity`
- `sort=endDate`

## 11. Topic de-dup and diversity

After ranking, curated markets are scanned in score order to reduce near-duplicate topic variants.

How it works:
- Build normalized token sets from each market question.
- Compare to already-kept markets in the same category using token-overlap similarity.
- If similarity passes threshold and shared tokens minimum:
  - keep only up to `COASENSUS_TOPIC_DEDUP_MAX_PER_CLUSTER` for that topic cluster
  - demote extras to rejected with:
    - `excluded_topic_duplicate_of_<anchor_market_id>`

This prevents the front page from being dominated by many variants of the same underlying event.

Default API behavior:
- Returns only curated markets (`is_curated = 1`)
- Paginated response (`page`, `pageSize`)
- Optional text search with `q=<term>` against market `question` and `description`

## 12. Why some markets appear first

Markets appear at the top when they combine:
- High semantic newsworthiness (`S_LLM`)
- Strong market participation (`volume`, `liquidity`) with log scaling
- Recent activity (lower time-decay penalty)

In practice, high-liquidity political/policy markets often rank first.

## 13. Current limitations (v1 heuristic)

This is still mostly heuristic + prompt-based filtering, so:
- It can still miss nuanced civic relevance.
- Topic de-dup is lexical; semantically similar events with different wording can still slip through.
- It does not yet use external source credibility scoring.

## 14. Source of truth in code

- Worker runtime curation used in production refresh:
  - `infra/cloudflare/workers/feed-api/src/refresh.ts`
- Shared filter-engine implementation and tests:
  - `services/filter-engine/src/filter.ts`
  - `services/filter-engine/src/filter.test.ts`
- Feed API sorting/filter behavior:
  - `infra/cloudflare/workers/feed-api/src/index.ts`

## 15. Telemetry

Admin-only endpoint:
- `GET /api/admin/semantic-metrics?limit=30`

Provides:
- recent semantic refresh runs
- aggregated LLM/cache metrics by prompt/provider/model

