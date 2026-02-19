import { normalizeActiveMarkets, type RawPolymarketMarket } from "./normalize.js";

export interface IngestSnapshot {
  fetchedAt: string;
  rawCount: number;
  normalizedCount: number;
  droppedCount: number;
}

export function buildIngestSnapshot(rawMarkets: RawPolymarketMarket[]): IngestSnapshot {
  const result = normalizeActiveMarkets(rawMarkets);
  return {
    fetchedAt: new Date().toISOString(),
    rawCount: rawMarkets.length,
    normalizedCount: result.markets.length,
    droppedCount: result.dropped,
  };
}

