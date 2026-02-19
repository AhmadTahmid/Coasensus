import { runAndPersistIngestion, runIngestionOnce } from "./index.js";
import { logError, logInfo } from "./logger.js";

function parseEnvInt(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main(): Promise<void> {
  const limitPerPage = parseEnvInt("POLYMARKET_LIMIT_PER_PAGE", 50);
  const maxPages = parseEnvInt("POLYMARKET_MAX_PAGES", 2);
  const retries = parseEnvInt("POLYMARKET_RETRIES", 2);
  const requestTimeoutMs = parseEnvInt("POLYMARKET_TIMEOUT_MS", 12000);
  const outputDir = process.env.INGEST_OUTPUT_DIR;
  const dbPath = process.env.INGEST_SQLITE_DB_PATH;
  const shouldPersist = process.env.INGEST_PERSIST !== "0";
  const persistJson = process.env.INGEST_PERSIST_JSON !== "0";
  const persistSqlite = process.env.INGEST_PERSIST_SQLITE !== "0";

  const fetchOptions = {
    limitPerPage,
    maxPages,
    retries,
    requestTimeoutMs,
  };

  logInfo("ingest.smoke.start", {
    limitPerPage,
    maxPages,
    retries,
    requestTimeoutMs,
    shouldPersist,
    persistJson,
    persistSqlite,
  });

  const result = shouldPersist
    ? await runAndPersistIngestion(fetchOptions, { outputDir, dbPath, persistJson, persistSqlite })
    : await runIngestionOnce(fetchOptions);

  const preview = result.normalizedMarkets.slice(0, 5).map((market, index) => ({
    rank: index + 1,
    id: market.id,
    question: market.question,
    endDate: market.endDate,
    volume: market.volume,
    liquidity: market.liquidity,
  }));

  // Keep output concise and machine-readable for CI or manual local checks.
  console.log(
    JSON.stringify(
      {
        smoke: "ok",
        snapshot: result.snapshot,
        metrics: result.metrics,
        persisted: {
          json: result.persistedJson ?? null,
          sqlite: result.persistedSqlite ?? null,
        },
        preview,
      },
      null,
      2
    )
  );

  logInfo("ingest.smoke.success", {
    runId: result.persistedJson?.runId ?? result.persistedSqlite?.runId ?? "n/a",
    rawCount: result.snapshot.rawCount,
    normalizedCount: result.snapshot.normalizedCount,
    droppedCount: result.snapshot.droppedCount,
    fetchMs: result.metrics.fetchMs,
    normalizeMs: result.metrics.normalizeMs,
    persistJsonMs: result.metrics.persistJsonMs,
    persistSqliteMs: result.metrics.persistSqliteMs,
    totalMs: result.metrics.totalMs,
  });
}

main().catch((error) => {
  logError("ingest.smoke.failed", {
    message: error instanceof Error ? error.message : String(error),
  });
  console.error(
    JSON.stringify(
      {
        smoke: "failed",
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exit(1);
});
