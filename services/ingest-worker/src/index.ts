import type { Market } from "@coasensus/shared-types";
import { normalizeActiveMarkets, type RawPolymarketMarket } from "./normalize.js";
import { fetchActiveMarkets, type PolymarketFetchOptions } from "./polymarket-client.js";
import {
  persistIngestionRun,
  type PersistedIngestionResult,
  type PersistIngestionOptions,
} from "./storage.js";

export interface IngestSnapshot {
  fetchedAt: string;
  pagesFetched: number;
  rawCount: number;
  normalizedCount: number;
  droppedCount: number;
}

export interface IngestRunResult {
  snapshot: IngestSnapshot;
  rawMarkets: RawPolymarketMarket[];
  normalizedMarkets: Market[];
  persisted?: PersistedIngestionResult;
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
  const fetchResult = await fetchActiveMarkets(options);
  const normalizedResult = normalizeActiveMarkets(fetchResult.markets);

  return {
    snapshot: buildIngestSnapshot(fetchResult.markets, fetchResult.pagesFetched),
    rawMarkets: fetchResult.markets,
    normalizedMarkets: normalizedResult.markets,
  };
}

export async function runAndPersistIngestion(
  fetchOptions: PolymarketFetchOptions = {},
  persistOptions: PersistIngestionOptions = {}
): Promise<IngestRunResult> {
  const result = await runIngestionOnce(fetchOptions);
  const persisted = await persistIngestionRun(
    {
      snapshot: result.snapshot,
      rawMarkets: result.rawMarkets,
      normalizedMarkets: result.normalizedMarkets,
    },
    persistOptions
  );

  return {
    ...result,
    persisted,
  };
}

export type { PolymarketFetchOptions, PersistIngestionOptions, PersistedIngestionResult };
