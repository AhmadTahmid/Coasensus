# Coasensus Filter Algorithm (Current v1)

This document explains how Coasensus decides which Polymarket markets appear in the feed.

## 1. High-level objective

The feed should prioritize civic-impact and newsworthy markets, while filtering out meme/noise markets.

## 2. Pipeline overview

1. Fetch active markets from Polymarket (`/markets`).
2. Normalize raw API payloads into a consistent market shape.
3. Apply hard exclusions (meme/sports/entertainment/noise tokens).
4. Detect category and score civic relevance.
5. Score newsworthiness from market activity and timing.
6. Mark each market as `curated` (shown by default) or `rejected`.
7. Persist full snapshot to D1 (`curated_feed`), including both curated and rejected rows.

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

Current exclusion themes:
- Meme/crypto noise: `meme`, `doge`, `pepe`, `crypto memecoin`
- Entertainment: `celebrity`, `james bond`, `oscar`, `grammy`, `movie`, `tv show`, `box office`
- Sports: `super bowl`, `world cup`, `tournament`, `masters`, `golf`, `tennis`, `formula 1`, `f1`, `basketball`, `football`, `baseball`, `hockey`, `nba`, `nfl`, `mlb`, `nhl`, `ufc`, `soccer`

## 6. Category detection

If not hard-excluded, the algorithm assigns one category:
- `politics`
- `economy`
- `policy`
- `geopolitics`
- `public_health`
- `climate_energy`
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

Adds points from activity and urgency:
- `+1` if `volume >= 25,000`
- `+1` if `liquidity >= 10,000`
- `+1` if `openInterest >= 5,000`
- `+1` if `volume >= 250,000` OR `liquidity >= 50,000`
- `+1` if market resolves within 14 days (future date window)

## 8. Inclusion vs rejection

A market is **curated** only if all are true:
1. Not hard-excluded.
2. `civicScore >= 2`
3. `newsworthinessScore >= 2`

Otherwise it is **rejected**.

Main rejection reasons:
- `excluded_<token>` (hard exclusion)
- `excluded_below_threshold` (did not reach score thresholds)

## 9. What is a "rejected market"?

A rejected market is still ingested and stored, but excluded from the default feed view.

Important:
- Rejected markets are available via API with `includeRejected=1`.
- This makes the system transparent and debuggable (you can inspect why it was filtered out).

## 10. Feed ranking and ordering

Default feed sorting (`sort=score`):
- Order by `(civic_score + newsworthiness_score) DESC`
- Tie-breaker: `market_id ASC`

Other supported sorts:
- `sort=volume`
- `sort=liquidity`
- `sort=endDate`

Default API behavior:
- Returns only curated markets (`is_curated = 1`)
- Paginated response (`page`, `pageSize`)

## 11. Why some markets appear first

Markets appear at the top when they combine:
- Strong civic keyword signals
- High market activity/liquidity/open interest
- Near-term resolution urgency

In practice, high-liquidity political/policy markets often rank first.

## 12. Current limitations (v1 heuristic)

This is a deterministic keyword-and-threshold system, so:
- It can still miss nuanced civic relevance.
- It is not yet event-deduplicated (same event may appear in multiple variants).
- It does not yet use source credibility, external news context, or semantic embeddings.

## 13. Source of truth in code

- Worker runtime curation used in production refresh:
  - `infra/cloudflare/workers/feed-api/src/refresh.ts`
- Shared filter-engine implementation and tests:
  - `services/filter-engine/src/filter.ts`
  - `services/filter-engine/src/filter.test.ts`
- Feed API sorting/filter behavior:
  - `infra/cloudflare/workers/feed-api/src/index.ts`

