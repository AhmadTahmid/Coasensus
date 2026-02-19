import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { curateMarkets } from "@coasensus/filter-engine";
import type { CuratedFeedItem, Market, MarketCategory } from "@coasensus/shared-types";

const DEFAULT_LATEST_NORMALIZED_PATH = path.resolve(
  fileURLToPath(new URL("../../../infra/db/local/latest/normalized.json", import.meta.url))
);

const CATEGORY_SET = new Set<MarketCategory>([
  "politics",
  "economy",
  "policy",
  "geopolitics",
  "public_health",
  "climate_energy",
  "other",
]);

export type FeedSort = "score" | "volume" | "liquidity" | "endDate";

export interface FeedQuery {
  page: number;
  pageSize: number;
  sort: FeedSort;
  category?: MarketCategory;
  includeRejected: boolean;
}

export interface FeedResponse {
  meta: {
    generatedAt: string;
    totalItems: number;
    totalPages: number;
    page: number;
    pageSize: number;
    sort: FeedSort;
    category: MarketCategory | null;
    includeRejected: boolean;
    sourcePath: string;
  };
  items: CuratedFeedItem[];
}

function asFiniteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function scoreValue(item: CuratedFeedItem): number {
  return item.score.civicScore + item.score.newsworthinessScore;
}

function dateValue(item: CuratedFeedItem): number {
  if (!item.endDate) {
    return Number.POSITIVE_INFINITY;
  }
  const value = new Date(item.endDate).getTime();
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function sortItems(items: CuratedFeedItem[], sort: FeedSort): CuratedFeedItem[] {
  const copy = [...items];

  if (sort === "volume") {
    copy.sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1));
    return copy;
  }
  if (sort === "liquidity") {
    copy.sort((a, b) => (b.liquidity ?? -1) - (a.liquidity ?? -1));
    return copy;
  }
  if (sort === "endDate") {
    copy.sort((a, b) => dateValue(a) - dateValue(b));
    return copy;
  }

  // score sort is default for relevance.
  copy.sort((a, b) => scoreValue(b) - scoreValue(a));
  return copy;
}

function isMarket(value: unknown): value is Market {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Partial<Market>;
  return typeof record.id === "string" && typeof record.question === "string" && typeof record.url === "string";
}

export function normalizeFeedQuery(input: URLSearchParams): FeedQuery {
  const page = Math.max(1, Math.floor(asFiniteNumber(input.get("page"), 1)));
  const requestedPageSize = Math.max(1, Math.floor(asFiniteNumber(input.get("pageSize"), 20)));
  const pageSize = Math.min(100, requestedPageSize);
  const sortCandidate = input.get("sort");
  const sort: FeedSort =
    sortCandidate === "volume" || sortCandidate === "liquidity" || sortCandidate === "endDate" || sortCandidate === "score"
      ? sortCandidate
      : "score";
  const categoryCandidate = input.get("category");
  const category =
    categoryCandidate && CATEGORY_SET.has(categoryCandidate as MarketCategory)
      ? (categoryCandidate as MarketCategory)
      : undefined;
  const includeRejected = input.get("includeRejected") === "1";

  return {
    page,
    pageSize,
    sort,
    category,
    includeRejected,
  };
}

export async function loadLatestNormalizedMarkets(sourcePath?: string): Promise<Market[]> {
  const filePath = path.resolve(sourcePath ?? DEFAULT_LATEST_NORMALIZED_PATH);
  const content = await readFile(filePath, "utf8");
  const parsed = JSON.parse(content) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Normalized markets file is not an array: ${filePath}`);
  }

  const markets = parsed.filter(isMarket);
  return markets;
}

export function buildFeedFromMarkets(markets: Market[], query: FeedQuery, sourcePath: string): FeedResponse {
  const curationResult = curateMarkets(markets);
  const baseItems = query.includeRejected
    ? [...curationResult.curated, ...curationResult.rejected]
    : curationResult.curated;

  const categoryFiltered = query.category
    ? baseItems.filter((item) => item.score.category === query.category)
    : baseItems;

  const sorted = sortItems(categoryFiltered, query.sort);
  const totalItems = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.pageSize;
  const end = start + query.pageSize;
  const pageItems = sorted.slice(start, end);

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      totalItems,
      totalPages,
      page,
      pageSize: query.pageSize,
      sort: query.sort,
      category: query.category ?? null,
      includeRejected: query.includeRejected,
      sourcePath,
    },
    items: pageItems,
  };
}

export async function loadAndBuildFeed(query: FeedQuery, sourcePath?: string): Promise<FeedResponse> {
  const resolvedSourcePath = path.resolve(sourcePath ?? DEFAULT_LATEST_NORMALIZED_PATH);
  const markets = await loadLatestNormalizedMarkets(resolvedSourcePath);
  return buildFeedFromMarkets(markets, query, resolvedSourcePath);
}

