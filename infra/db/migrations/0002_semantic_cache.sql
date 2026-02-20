-- Coasensus D1 semantic cache
-- Apply with:
-- wrangler d1 migrations apply coasensus-staging --remote --config infra/cloudflare/wrangler.api.jsonc --env staging
-- wrangler d1 migrations apply coasensus-production --remote --config infra/cloudflare/wrangler.api.jsonc --env production

CREATE TABLE IF NOT EXISTS semantic_market_cache (
  market_id TEXT PRIMARY KEY,
  prompt_version TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  is_meme INTEGER NOT NULL,
  newsworthiness_score REAL NOT NULL,
  category TEXT NOT NULL,
  geo_tag TEXT NOT NULL DEFAULT 'World',
  confidence REAL,
  model_name TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_semantic_cache_updated_at ON semantic_market_cache(updated_at);
CREATE INDEX IF NOT EXISTS idx_semantic_cache_prompt_version ON semantic_market_cache(prompt_version);
