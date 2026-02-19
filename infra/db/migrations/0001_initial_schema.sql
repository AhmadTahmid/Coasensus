-- Coasensus D1 initial schema
-- Applied via:
-- wrangler d1 migrations apply coasensus-staging --remote --config infra/cloudflare/wrangler.api.jsonc --env staging
-- wrangler d1 migrations apply coasensus-production --remote --config infra/cloudflare/wrangler.api.jsonc --env production

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ingestion_runs (
  run_id TEXT PRIMARY KEY,
  fetched_at TEXT NOT NULL,
  pages_fetched INTEGER NOT NULL,
  raw_count INTEGER NOT NULL,
  normalized_count INTEGER NOT NULL,
  dropped_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS latest_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  run_id TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS markets_raw (
  run_id TEXT NOT NULL,
  market_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  PRIMARY KEY (run_id, market_id)
);

CREATE TABLE IF NOT EXISTS markets_normalized (
  run_id TEXT NOT NULL,
  market_id TEXT NOT NULL,
  question TEXT NOT NULL,
  volume REAL,
  liquidity REAL,
  end_date TEXT,
  payload_json TEXT NOT NULL,
  PRIMARY KEY (run_id, market_id)
);

CREATE INDEX IF NOT EXISTS idx_markets_normalized_run ON markets_normalized(run_id);
CREATE INDEX IF NOT EXISTS idx_markets_normalized_volume ON markets_normalized(volume);

CREATE TABLE IF NOT EXISTS curated_feed (
  market_id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  end_date TEXT,
  liquidity REAL,
  volume REAL,
  open_interest REAL,
  category TEXT NOT NULL,
  civic_score REAL NOT NULL,
  newsworthiness_score REAL NOT NULL,
  is_curated INTEGER NOT NULL DEFAULT 0,
  decision_reason TEXT NOT NULL,
  reason_codes_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_curated_feed_curated ON curated_feed(is_curated);
CREATE INDEX IF NOT EXISTS idx_curated_feed_category ON curated_feed(category);
CREATE INDEX IF NOT EXISTS idx_curated_feed_score ON curated_feed(civic_score, newsworthiness_score);
CREATE INDEX IF NOT EXISTS idx_curated_feed_end_date ON curated_feed(end_date);

CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  event TEXT NOT NULL,
  source TEXT NOT NULL,
  session_id TEXT,
  page_url TEXT,
  details_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_ts ON analytics_events(ts);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event ON analytics_events(event);
