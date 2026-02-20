-- Coasensus D1 front-page ranking score
-- Apply with:
-- wrangler d1 migrations apply coasensus-staging --remote --config infra/cloudflare/wrangler.api.jsonc --env staging
-- wrangler d1 migrations apply coasensus-production --remote --config infra/cloudflare/wrangler.api.jsonc --env production

ALTER TABLE curated_feed
ADD COLUMN front_page_score REAL NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_curated_feed_front_page_score ON curated_feed(front_page_score);

