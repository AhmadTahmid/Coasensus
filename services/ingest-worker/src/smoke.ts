import { runAndPersistIngestion, runIngestionOnce } from "./index.js";
import {
  DEFAULT_POLYMARKET_MARKET_WS_URL,
  SmartFirehoseClient,
  type SmartFirehoseLogger,
} from "./polymarket-firehose.js";
import { logError, logInfo, logWarn } from "./logger.js";

function parseEnvInt(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseEnvBool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }
  return fallback;
}

function parseEnvJsonObject(name: string): Record<string, unknown> | null {
  const value = process.env[name];
  if (!value || !value.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const limitPerPage = parseEnvInt("POLYMARKET_LIMIT_PER_PAGE", 50);
  const maxPages = parseEnvInt("POLYMARKET_MAX_PAGES", 2);
  const retries = parseEnvInt("POLYMARKET_RETRIES", 2);
  const requestTimeoutMs = parseEnvInt("POLYMARKET_TIMEOUT_MS", 12000);
  const useSmartFirehose = parseEnvBool("INGEST_USE_SMART_FIREHOSE", false);
  const firehoseMaxStalenessMs = parseEnvInt("INGEST_FIREHOSE_STALENESS_MS", 90_000);
  const firehoseReconnectBaseMs = parseEnvInt("INGEST_FIREHOSE_RECONNECT_BASE_MS", 800);
  const firehoseReconnectMaxMs = parseEnvInt("INGEST_FIREHOSE_RECONNECT_MAX_MS", 15_000);
  const firehoseWarmupMs = parseEnvInt("INGEST_FIREHOSE_WARMUP_MS", 4_000);
  const firehoseWsUrl = process.env.INGEST_FIREHOSE_WS_URL || DEFAULT_POLYMARKET_MARKET_WS_URL;
  const firehoseSubscription = parseEnvJsonObject("INGEST_FIREHOSE_SUBSCRIPTION_JSON");
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
    useSmartFirehose,
    firehoseMaxStalenessMs,
    firehoseWarmupMs,
    shouldPersist,
    persistJson,
    persistSqlite,
  });

  const firehoseLogger: SmartFirehoseLogger = {
    info: (event, details = {}) => logInfo(event, details),
    warn: (event, details = {}) => logWarn(event, details),
  };

  const firehoseClient = useSmartFirehose
    ? new SmartFirehoseClient({
        websocketUrl: firehoseWsUrl,
        subscriptionMessage: firehoseSubscription,
        snapshotMaxStalenessMs: firehoseMaxStalenessMs,
        reconnectBaseMs: firehoseReconnectBaseMs,
        reconnectMaxMs: firehoseReconnectMaxMs,
        logger: firehoseLogger,
      })
    : null;

  try {
    if (firehoseClient) {
      firehoseClient.start();
      if (firehoseWarmupMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, firehoseWarmupMs));
      }
    }

    const runOptions = firehoseClient
      ? {
          ...fetchOptions,
          firehoseClient,
          firehoseMaxStalenessMs,
        }
      : fetchOptions;

    const result = shouldPersist
      ? await runAndPersistIngestion(runOptions, { outputDir, dbPath, persistJson, persistSqlite })
      : await runIngestionOnce(runOptions);

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
          firehose: firehoseClient ? firehoseClient.getSnapshot(firehoseMaxStalenessMs) : null,
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
      source: result.snapshot.source,
      rawCount: result.snapshot.rawCount,
      normalizedCount: result.snapshot.normalizedCount,
      droppedCount: result.snapshot.droppedCount,
      fetchMs: result.metrics.fetchMs,
      normalizeMs: result.metrics.normalizeMs,
      persistJsonMs: result.metrics.persistJsonMs,
      persistSqliteMs: result.metrics.persistSqliteMs,
      totalMs: result.metrics.totalMs,
    });
  } finally {
    if (firehoseClient) {
      firehoseClient.stop();
    }
  }
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
