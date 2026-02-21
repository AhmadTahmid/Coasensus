-- Coasensus D1 curated feed geo-tag support
-- Apply with:
-- wrangler d1 migrations apply coasensus-staging --remote --config infra/cloudflare/wrangler.api.jsonc --env staging
-- wrangler d1 migrations apply coasensus-production --remote --config infra/cloudflare/wrangler.api.jsonc --env production

ALTER TABLE curated_feed
ADD COLUMN geo_tag TEXT NOT NULL DEFAULT 'World';

CREATE INDEX IF NOT EXISTS idx_curated_feed_geo_tag ON curated_feed(geo_tag);
