import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import type { Market } from "@coasensus/shared-types";
import type { IngestSnapshot } from "./index.js";
import type { RawPolymarketMarket } from "./normalize.js";

const DEFAULT_SQLITE_DB_PATH = resolve(
  fileURLToPath(new URL("../../../infra/db/coasensus.sqlite", import.meta.url))
);

export interface PersistSqliteOptions {
  dbPath?: string;
}

export interface PersistSqliteInput {
  snapshot: IngestSnapshot;
  rawMarkets: RawPolymarketMarket[];
  normalizedMarkets: Market[];
}

export interface PersistedSqliteResult {
  dbPath: string;
  runId: string;
  rawRows: number;
  normalizedRows: number;
}

export interface SqliteLatestMarketsResult {
  dbPath: string;
  runId: string | null;
  markets: Market[];
}

function toRunId(isoDate: string): string {
  return isoDate.replace(/[:.]/g, "-");
}

function isMarket(value: unknown): value is Market {
  if (!value || typeof value !== "object") {
    return false;
  }
  const market = value as Partial<Market>;
  return typeof market.id === "string" && typeof market.question === "string" && typeof market.url === "string";
}

function initSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA journal_mode = WAL;

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
  `);
}

export async function persistIngestionRunSqlite(
  input: PersistSqliteInput,
  options: PersistSqliteOptions = {}
): Promise<PersistedSqliteResult> {
  const dbPath = resolve(options.dbPath ?? DEFAULT_SQLITE_DB_PATH);
  await mkdir(dirname(dbPath), { recursive: true });

  const runId = toRunId(input.snapshot.fetchedAt);
  const db = new DatabaseSync(dbPath);
  let rawRows = 0;
  let normalizedRows = 0;

  try {
    initSchema(db);

    const upsertRun = db.prepare(`
      INSERT INTO ingestion_runs (
        run_id, fetched_at, pages_fetched, raw_count, normalized_count, dropped_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(run_id) DO UPDATE SET
        fetched_at = excluded.fetched_at,
        pages_fetched = excluded.pages_fetched,
        raw_count = excluded.raw_count,
        normalized_count = excluded.normalized_count,
        dropped_count = excluded.dropped_count
    `);
    const upsertLatest = db.prepare(`
      INSERT INTO latest_state (id, run_id, updated_at)
      VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        run_id = excluded.run_id,
        updated_at = excluded.updated_at
    `);
    const upsertRaw = db.prepare(`
      INSERT OR REPLACE INTO markets_raw (run_id, market_id, payload_json)
      VALUES (?, ?, ?)
    `);
    const upsertNormalized = db.prepare(`
      INSERT OR REPLACE INTO markets_normalized (
        run_id, market_id, question, volume, liquidity, end_date, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const nowIso = new Date().toISOString();

    db.exec("BEGIN");
    try {
      upsertRun.run(
        runId,
        input.snapshot.fetchedAt,
        input.snapshot.pagesFetched,
        input.snapshot.rawCount,
        input.snapshot.normalizedCount,
        input.snapshot.droppedCount,
        nowIso
      );

      for (const raw of input.rawMarkets) {
        const marketId = String(raw.id ?? raw.marketId ?? "").trim();
        if (!marketId) {
          continue;
        }
        upsertRaw.run(runId, marketId, JSON.stringify(raw));
        rawRows += 1;
      }

      for (const market of input.normalizedMarkets) {
        upsertNormalized.run(
          runId,
          market.id,
          market.question,
          market.volume,
          market.liquidity,
          market.endDate,
          JSON.stringify(market)
        );
        normalizedRows += 1;
      }

      upsertLatest.run(runId, nowIso);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.close();
  }

  return {
    dbPath,
    runId,
    rawRows,
    normalizedRows,
  };
}

export async function loadLatestNormalizedMarketsSqlite(
  options: PersistSqliteOptions = {}
): Promise<SqliteLatestMarketsResult> {
  const dbPath = resolve(options.dbPath ?? DEFAULT_SQLITE_DB_PATH);
  await mkdir(dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  try {
    initSchema(db);

    const latest = db.prepare("SELECT run_id FROM latest_state WHERE id = 1").get() as
      | { run_id: string }
      | undefined;
    const fallback = db.prepare("SELECT run_id FROM ingestion_runs ORDER BY fetched_at DESC LIMIT 1").get() as
      | { run_id: string }
      | undefined;

    const runId = latest?.run_id ?? fallback?.run_id ?? null;
    if (!runId) {
      return { dbPath, runId: null, markets: [] };
    }

    const rows = db.prepare("SELECT payload_json FROM markets_normalized WHERE run_id = ?").all(runId) as Array<{
      payload_json: string;
    }>;

    const markets: Market[] = [];
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.payload_json) as unknown;
        if (isMarket(parsed)) {
          markets.push(parsed);
        }
      } catch {
        // Ignore malformed rows; feed can still work with valid ones.
      }
    }

    return { dbPath, runId, markets };
  } finally {
    db.close();
  }
}

export { DEFAULT_SQLITE_DB_PATH };

