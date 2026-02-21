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
  outcomes?: string[] | string;
  outcomePrices?: number[] | string[] | string;
  lastTradePrice?: number | string;
  bestBid?: number | string;
  bestAsk?: number | string;
  price?: number | string;
  tags?: string[] | string;
  events?: Array<{
    title?: string;
    slug?: string;
    openInterest?: number | string;
    tags?: string[] | string;
  }>;
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

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
      }
    } catch {
      // fall through to comma split
    }
  }
  return trimmed
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumberArray(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item));
  }
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => Number(item))
          .filter((item) => Number.isFinite(item));
      }
    } catch {
      // fall through to comma split
    }
  }
  return trimmed
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
}

function normalizeProbability(value: number | null): number | null {
  if (value === null) {
    return null;
  }
  if (value >= 0 && value <= 1) {
    return Number(value.toFixed(6));
  }
  if (value > 1 && value <= 100) {
    return Number((value / 100).toFixed(6));
  }
  return null;
}

function extractProbability(raw: RawPolymarketMarket): number | null {
  const outcomes = parseStringArray(raw.outcomes);
  const prices = parseNumberArray(raw.outcomePrices);

  if (outcomes.length > 0 && outcomes.length === prices.length) {
    const yesIndex = outcomes.findIndex((label) => label.trim().toLowerCase() === "yes");
    if (yesIndex >= 0) {
      const yesPrice = normalizeProbability(prices[yesIndex] ?? null);
      if (yesPrice !== null) {
        return yesPrice;
      }
    }
    const first = normalizeProbability(prices[0] ?? null);
    if (first !== null) {
      return first;
    }
  } else if (prices.length > 0) {
    const first = normalizeProbability(prices[0] ?? null);
    if (first !== null) {
      return first;
    }
  }

  const direct = normalizeProbability(asNumberOrNull(raw.lastTradePrice ?? raw.price));
  if (direct !== null) {
    return direct;
  }

  const bid = asNumberOrNull(raw.bestBid);
  const ask = asNumberOrNull(raw.bestAsk);
  if (bid !== null && ask !== null) {
    return normalizeProbability((bid + ask) / 2);
  }

  return null;
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

function extractEventTags(raw: RawPolymarketMarket): string[] {
  if (!Array.isArray(raw.events)) {
    return [];
  }

  const allTags = raw.events.flatMap((event) => normalizeTags(event.tags));
  return [...new Set(allTags)];
}

function toHttpsPolymarketUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.hostname === "polymarket.com" || parsed.hostname.endsWith(".polymarket.com")) {
      parsed.protocol = "https:";
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function inferMarketUrl(raw: RawPolymarketMarket, id: string): string {
  const directUrl = asStringOrNull(raw.url);
  if (directUrl) {
    const polymarketUrl = toHttpsPolymarketUrl(directUrl);
    if (polymarketUrl) {
      return polymarketUrl;
    }
  }

  if (raw.slug && raw.slug.trim().length > 0) {
    return `https://polymarket.com/event/${raw.slug.trim()}`;
  }

  if (Array.isArray(raw.events) && raw.events.length > 0) {
    const eventSlug = asStringOrNull(raw.events[0]?.slug);
    if (eventSlug) {
      return `https://polymarket.com/event/${eventSlug}`;
    }
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
  const directTags = normalizeTags(raw.tags);
  const eventTags = extractEventTags(raw);

  return {
    id,
    question,
    description: asStringOrNull(raw.description),
    url,
    probability: extractProbability(raw),
    endDate:
      asStringOrNull(raw.endDate) ??
      asStringOrNull(raw.end_date) ??
      asStringOrNull(raw.resolutionDate),
    liquidity: asNumberOrNull(raw.liquidity ?? raw.liquidityNum),
    volume: asNumberOrNull(raw.volume ?? raw.volumeNum),
    openInterest: asNumberOrNull(raw.openInterest ?? raw.open_interest ?? raw.events?.[0]?.openInterest),
    tags: [...new Set([...directTags, ...eventTags])],
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
