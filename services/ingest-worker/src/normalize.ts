import type { Market } from "@coasensus/shared-types";

export interface RawPolymarketMarket {
  id?: string | number;
  marketId?: string | number;
  slug?: string;
  url?: string;
  question?: string;
  title?: string;
  description?: string;
  endDate?: string;
  end_date?: string;
  resolutionDate?: string;
  liquidity?: number | string;
  liquidityNum?: number | string;
  volume?: number | string;
  volumeNum?: number | string;
  openInterest?: number | string;
  open_interest?: number | string;
  tags?: string[] | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface NormalizationResult {
  markets: Market[];
  dropped: number;
}

function asNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

function inferMarketUrl(raw: RawPolymarketMarket, id: string): string {
  const directUrl = asStringOrNull(raw.url);
  if (directUrl) {
    return directUrl;
  }

  if (raw.slug && raw.slug.trim().length > 0) {
    return `https://polymarket.com/event/${raw.slug.trim()}`;
  }

  return `https://polymarket.com/market/${id}`;
}

export function normalizeMarket(raw: RawPolymarketMarket): Market {
  const idValue = raw.id ?? raw.marketId;
  if (idValue === null || idValue === undefined || String(idValue).trim() === "") {
    throw new Error("Market id missing");
  }

  const question = asStringOrNull(raw.question) ?? asStringOrNull(raw.title);
  if (!question) {
    throw new Error("Market question missing");
  }

  const id = String(idValue).trim();
  const url = inferMarketUrl(raw, id);

  return {
    id,
    question,
    description: asStringOrNull(raw.description),
    url,
    endDate:
      asStringOrNull(raw.endDate) ??
      asStringOrNull(raw.end_date) ??
      asStringOrNull(raw.resolutionDate),
    liquidity: asNumberOrNull(raw.liquidity ?? raw.liquidityNum),
    volume: asNumberOrNull(raw.volume ?? raw.volumeNum),
    openInterest: asNumberOrNull(raw.openInterest ?? raw.open_interest),
    tags: normalizeTags(raw.tags),
    createdAt: asStringOrNull(raw.createdAt),
    updatedAt: asStringOrNull(raw.updatedAt),
  };
}

export function normalizeActiveMarkets(rawMarkets: unknown[]): NormalizationResult {
  const markets: Market[] = [];
  let dropped = 0;

  for (const raw of rawMarkets) {
    try {
      if (!raw || typeof raw !== "object") {
        throw new Error("Invalid payload");
      }
      markets.push(normalizeMarket(raw as RawPolymarketMarket));
    } catch {
      dropped += 1;
    }
  }

  return { markets, dropped };
}

