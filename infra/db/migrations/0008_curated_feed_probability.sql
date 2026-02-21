-- Coasensus D1 curated_feed probability/price column
-- Apply with:
-- wrangler d1 migrations apply coasensus-staging --remote --config infra/cloudflare/wrangler.api.jsonc --env staging
-- wrangler d1 migrations apply coasensus-production --remote --config infra/cloudflare/wrangler.api.jsonc --env production

ALTER TABLE curated_feed ADD COLUMN probability REAL;

CREATE INDEX IF NOT EXISTS idx_curated_feed_probability ON curated_feed(probability);
