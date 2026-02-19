import type { RawPolymarketMarket } from "./normalize.js";

export interface PolymarketFetchOptions {
  baseUrl?: string;
  limitPerPage?: number;
  maxPages?: number;
  requestTimeoutMs?: number;
  retries?: number;
  retryBackoffMs?: number;
  fetchImpl?: typeof fetch;
}

export interface ActiveMarketsFetchResult {
  markets: RawPolymarketMarket[];
  pagesFetched: number;
}

const DEFAULTS: Required<Omit<PolymarketFetchOptions, "fetchImpl">> = {
  baseUrl: "https://gamma-api.polymarket.com",
  limitPerPage: 100,
  maxPages: 10,
  requestTimeoutMs: 12_000,
  retries: 2,
  retryBackoffMs: 400,
};

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function buildPageUrl(baseUrl: string, limit: number, offset: number): string {
  const url = new URL(`${normalizeBaseUrl(baseUrl)}/markets`);
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("archived", "false");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  return url.toString();
}

async function fetchJsonWithTimeout(
  url: string,
  timeoutMs: number,
  fetchImpl: typeof fetch
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from Polymarket`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPageWithRetry(
  url: string,
  retries: number,
  retryBackoffMs: number,
  timeoutMs: number,
  fetchImpl: typeof fetch
): Promise<RawPolymarketMarket[]> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      const payload = await fetchJsonWithTimeout(url, timeoutMs, fetchImpl);
      if (!Array.isArray(payload)) {
        throw new Error("Polymarket response is not an array");
      }
      return payload as RawPolymarketMarket[];
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }
      const backoff = retryBackoffMs * (attempt + 1);
      await sleep(backoff);
      attempt += 1;
    }
  }

  throw new Error(`Failed to fetch Polymarket markets after ${retries + 1} attempts: ${String(lastError)}`);
}

function isLikelyActiveMarket(market: RawPolymarketMarket): boolean {
  const maybeActive = (market as { active?: boolean }).active;
  const maybeClosed = (market as { closed?: boolean }).closed;
  const maybeArchived = (market as { archived?: boolean }).archived;

  if (maybeActive === false) {
    return false;
  }
  if (maybeClosed === true) {
    return false;
  }
  if (maybeArchived === true) {
    return false;
  }
  return true;
}

export async function fetchActiveMarkets(
  options: PolymarketFetchOptions = {}
): Promise<ActiveMarketsFetchResult> {
  const {
    baseUrl,
    limitPerPage,
    maxPages,
    requestTimeoutMs,
    retries,
    retryBackoffMs,
    fetchImpl,
  } = {
    ...DEFAULTS,
    ...options,
  };

  const runFetch = fetchImpl ?? fetch;
  if (typeof runFetch !== "function") {
    throw new Error("No fetch implementation available");
  }

  const seenIds = new Set<string>();
  const markets: RawPolymarketMarket[] = [];
  let pagesFetched = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * limitPerPage;
    const url = buildPageUrl(baseUrl, limitPerPage, offset);
    const pageData = await fetchPageWithRetry(url, retries, retryBackoffMs, requestTimeoutMs, runFetch);
    pagesFetched += 1;

    for (const market of pageData) {
      if (!isLikelyActiveMarket(market)) {
        continue;
      }
      const id = String(market.id ?? market.marketId ?? "").trim();
      if (!id || seenIds.has(id)) {
        continue;
      }
      seenIds.add(id);
      markets.push(market);
    }

    if (pageData.length < limitPerPage) {
      break;
    }
  }

  return { markets, pagesFetched };
}

