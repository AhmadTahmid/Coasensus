-- Coasensus D1 curated feed trend-shift support
-- Apply with:
-- wrangler d1 migrations apply coasensus-staging --remote --config infra/cloudflare/wrangler.api.jsonc --env staging
-- wrangler d1 migrations apply coasensus-production --remote --config infra/cloudflare/wrangler.api.jsonc --env production

ALTER TABLE curated_feed
ADD COLUMN trend_delta REAL NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_curated_feed_trend_delta ON curated_feed(trend_delta DESC);
