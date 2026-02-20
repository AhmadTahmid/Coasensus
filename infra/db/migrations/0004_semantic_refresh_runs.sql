-- Coasensus D1 semantic refresh telemetry
-- Apply with:
-- wrangler d1 migrations apply coasensus-staging --remote --config infra/cloudflare/wrangler.api.jsonc --env staging
-- wrangler d1 migrations apply coasensus-production --remote --config infra/cloudflare/wrangler.api.jsonc --env production

CREATE TABLE IF NOT EXISTS semantic_refresh_runs (
  run_id TEXT PRIMARY KEY,
  fetched_at TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  llm_enabled INTEGER NOT NULL,
  llm_provider TEXT NOT NULL DEFAULT 'openai',
  llm_model TEXT NOT NULL,
  pages_fetched INTEGER NOT NULL,
  raw_count INTEGER NOT NULL,
  normalized_count INTEGER NOT NULL,
  curated_count INTEGER NOT NULL,
  rejected_count INTEGER NOT NULL,
  bouncer_dropped_count INTEGER NOT NULL,
  cache_hits INTEGER NOT NULL,
  cache_misses INTEGER NOT NULL,
  llm_evaluated INTEGER NOT NULL,
  heuristic_evaluated INTEGER NOT NULL,
  llm_failures INTEGER NOT NULL,
  total_ms INTEGER NOT NULL,
  fetch_ms INTEGER NOT NULL,
  normalize_ms INTEGER NOT NULL,
  persist_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_semantic_refresh_runs_fetched_at ON semantic_refresh_runs(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_semantic_refresh_runs_prompt ON semantic_refresh_runs(prompt_version, llm_model);

