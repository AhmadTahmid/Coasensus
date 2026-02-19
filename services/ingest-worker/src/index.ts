import type { Market } from "@coasensus/shared-types";
import { normalizeActiveMarkets, type RawPolymarketMarket } from "./normalize.js";
import { fetchActiveMarkets, type PolymarketFetchOptions } from "./polymarket-client.js";
import {
  persistIngestionRun,
  type PersistIngestionOptions,
  type PersistedIngestionResult,
} from "./storage.js";
import {
  persistIngestionRunSqlite,
  type PersistedSqliteResult,
  type PersistSqliteOptions,
} from "./sqlite-storage.js";

export interface IngestSnapshot {
  fetchedAt: string;
  pagesFetched: number;
  rawCount: number;
  normalizedCount: number;
  droppedCount: number;
}

export interface IngestMetrics {
  startedAt: string;
  finishedAt: string;
  fetchMs: number;
  normalizeMs: number;
  persistJsonMs: number;
  persistSqliteMs: number;
  totalMs: number;
}

export interface RunAndPersistOptions extends PersistIngestionOptions, PersistSqliteOptions {
  persistJson?: boolean;
  persistSqlite?: boolean;
}

export interface IngestRunResult {
  snapshot: IngestSnapshot;
  rawMarkets: RawPolymarketMarket[];
  normalizedMarkets: Market[];
  persistedJson?: PersistedIngestionResult;
  persistedSqlite?: PersistedSqliteResult;
  metrics: IngestMetrics;
}

export function buildIngestSnapshot(rawMarkets: RawPolymarketMarket[], pagesFetched = 0): IngestSnapshot {
  const result = normalizeActiveMarkets(rawMarkets);
  return {
    fetchedAt: new Date().toISOString(),
    pagesFetched,
    rawCount: rawMarkets.length,
    normalizedCount: result.markets.length,
    droppedCount: result.dropped,
  };
}

export async function runIngestionOnce(options: PolymarketFetchOptions = {}): Promise<IngestRunResult> {
  const totalStarted = Date.now();
  const fetchStarted = Date.now();
  const fetchResult = await fetchActiveMarkets(options);
  const fetchMs = Date.now() - fetchStarted;

  const normalizeStarted = Date.now();
  const normalizedResult = normalizeActiveMarkets(fetchResult.markets);
  const normalizeMs = Date.now() - normalizeStarted;
  const totalMs = Date.now() - totalStarted;
  const finishedAt = new Date().toISOString();

  return {
    snapshot: buildIngestSnapshot(fetchResult.markets, fetchResult.pagesFetched),
    rawMarkets: fetchResult.markets,
    normalizedMarkets: normalizedResult.markets,
    metrics: {
      startedAt: new Date(totalStarted).toISOString(),
      finishedAt,
      fetchMs,
      normalizeMs,
      persistJsonMs: 0,
      persistSqliteMs: 0,
      totalMs,
    },
  };
}

export async function runAndPersistIngestion(
  fetchOptions: PolymarketFetchOptions = {},
  persistOptions: RunAndPersistOptions = {}
): Promise<IngestRunResult> {
  const persistJson = persistOptions.persistJson ?? true;
  const persistSqlite = persistOptions.persistSqlite ?? true;

  const result = await runIngestionOnce(fetchOptions);
  let persistedJson: PersistedIngestionResult | undefined;
  let persistedSqlite: PersistedSqliteResult | undefined;
  let persistJsonMs = 0;
  let persistSqliteMs = 0;

  if (persistJson) {
    const started = Date.now();
    persistedJson = await persistIngestionRun(
      {
        snapshot: result.snapshot,
        rawMarkets: result.rawMarkets,
        normalizedMarkets: result.normalizedMarkets,
      },
      {
        outputDir: persistOptions.outputDir,
      }
    );
    persistJsonMs = Date.now() - started;
  }

  if (persistSqlite) {
    const started = Date.now();
    persistedSqlite = await persistIngestionRunSqlite(
      {
        snapshot: result.snapshot,
        rawMarkets: result.rawMarkets,
        normalizedMarkets: result.normalizedMarkets,
      },
      {
        dbPath: persistOptions.dbPath,
      }
    );
    persistSqliteMs = Date.now() - started;
  }

  const finishedAt = new Date().toISOString();
  const startedAtEpoch = new Date(result.metrics.startedAt).getTime();
  const totalMs = Math.max(0, Date.now() - startedAtEpoch);

  return {
    ...result,
    persistedJson,
    persistedSqlite,
    metrics: {
      ...result.metrics,
      finishedAt,
      persistJsonMs,
      persistSqliteMs,
      totalMs,
    },
  };
}

export type {
  PersistIngestionOptions,
  PersistSqliteOptions,
  PersistedIngestionResult,
  PersistedSqliteResult,
  PolymarketFetchOptions,
};
