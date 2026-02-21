-- Coasensus D1 semantic failover state
-- Apply with:
-- wrangler d1 migrations apply coasensus-staging --remote --config infra/cloudflare/wrangler.api.jsonc --env staging
-- wrangler d1 migrations apply coasensus-production --remote --config infra/cloudflare/wrangler.api.jsonc --env production

CREATE TABLE IF NOT EXISTS semantic_failover_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  cooldown_runs_remaining INTEGER NOT NULL DEFAULT 0,
  last_triggered_at TEXT,
  last_reason TEXT,
  updated_at TEXT NOT NULL
);

INSERT INTO semantic_failover_state (
  id,
  consecutive_failures,
  cooldown_runs_remaining,
  last_triggered_at,
  last_reason,
  updated_at
)
VALUES (1, 0, 0, NULL, 'init', CURRENT_TIMESTAMP)
ON CONFLICT(id) DO NOTHING;
