type MarketCategory =
  | "politics"
  | "economy"
  | "policy"
  | "geopolitics"
  | "public_health"
  | "climate_energy"
  | "other";

interface Market {
  id: string;
  question: string;
  description: string | null;
  url: string;
  endDate: string | null;
  liquidity: number | null;
  volume: number | null;
  openInterest: number | null;
  tags: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

interface MarketScoreBreakdown {
  civicScore: number;
  newsworthinessScore: number;
  category: MarketCategory;
  reasonCodes: string[];
}

interface CuratedFeedItem extends Market {
  isCurated: boolean;
  decisionReason: string;
  score: MarketScoreBreakdown;
}

interface RawPolymarketMarket {
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
  events?: Array<{
    title?: string;
    slug?: string;
    openInterest?: number | string;
    tags?: string[] | string;
  }>;
  createdAt?: string;
  updatedAt?: string;
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
}

interface RefreshEnv {
  DB: D1Database;
  POLYMARKET_BASE_URL?: string;
  COASENSUS_INGEST_LIMIT_PER_PAGE?: string;
  COASENSUS_INGEST_MAX_PAGES?: string;
  COASENSUS_INGEST_RETRIES?: string;
  COASENSUS_INGEST_TIMEOUT_MS?: string;
  COASENSUS_INGEST_RETRY_BACKOFF_MS?: string;
}

interface FetchOptions {
  baseUrl: string;
  limitPerPage: number;
  maxPages: number;
  requestTimeoutMs: number;
  retries: number;
  retryBackoffMs: number;
}

interface ActiveMarketsFetchResult {
  markets: RawPolymarketMarket[];
  pagesFetched: number;
}

interface NormalizationResult {
  markets: Market[];
  dropped: number;
}

interface CurationResult {
  curated: CuratedFeedItem[];
  rejected: CuratedFeedItem[];
}

export interface FeedCounts {
  total: number;
  curated: number;
  rejected: number;
}

export interface RefreshSummary {
  runId: string;
  fetchedAt: string;
  pagesFetched: number;
  rawCount: number;
  normalizedCount: number;
  droppedCount: number;
  curatedCount: number;
  rejectedCount: number;
  metrics: {
    totalMs: number;
    fetchMs: number;
    normalizeMs: number;
    persistMs: number;
  };
}

const DEFAULT_FETCH_OPTIONS: FetchOptions = {
  baseUrl: "https://gamma-api.polymarket.com",
  limitPerPage: 100,
  maxPages: 8,
  requestTimeoutMs: 12_000,
  retries: 2,
  retryBackoffMs: 400,
};

const EXCLUSION_TOKENS = [
  "meme",
  "doge",
  "pepe",
  "gossip",
  "celebrity",
  "nba",
  "nfl",
  "soccer",
  "ufc",
  "crypto memecoin",
];

const CATEGORY_MAP: Record<MarketCategory, string[]> = {
  politics: ["election", "vote", "senate", "house", "president", "prime minister"],
  economy: ["inflation", "gdp", "recession", "unemployment", "federal reserve", "interest rate"],
  policy: ["bill", "law", "regulation", "policy", "court", "supreme court"],
  geopolitics: ["war", "conflict", "ceasefire", "sanction", "nato", "china", "russia", "taiwan"],
  public_health: ["pandemic", "vaccine", "cdc", "who", "outbreak", "public health"],
  climate_energy: ["climate", "emissions", "oil", "gas", "renewable", "energy", "carbon"],
  other: [],
};

function asPositiveInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function resolveFetchOptions(env: RefreshEnv): FetchOptions {
  return {
    baseUrl: env.POLYMARKET_BASE_URL?.trim() || DEFAULT_FETCH_OPTIONS.baseUrl,
    limitPerPage: asPositiveInt(env.COASENSUS_INGEST_LIMIT_PER_PAGE, DEFAULT_FETCH_OPTIONS.limitPerPage, 1, 500),
    maxPages: asPositiveInt(env.COASENSUS_INGEST_MAX_PAGES, DEFAULT_FETCH_OPTIONS.maxPages, 1, 30),
    requestTimeoutMs: asPositiveInt(env.COASENSUS_INGEST_TIMEOUT_MS, DEFAULT_FETCH_OPTIONS.requestTimeoutMs, 1000, 60000),
    retries: asPositiveInt(env.COASENSUS_INGEST_RETRIES, DEFAULT_FETCH_OPTIONS.retries, 0, 8),
    retryBackoffMs: asPositiveInt(
      env.COASENSUS_INGEST_RETRY_BACKOFF_MS,
      DEFAULT_FETCH_OPTIONS.retryBackoffMs,
      0,
      10000
    ),
  };
}

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

async function fetchJsonWithTimeout(url: string, _timeoutMs: number): Promise<unknown> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from Polymarket`);
  }
  return response.json();
}

async function fetchPageWithRetry(
  url: string,
  retries: number,
  retryBackoffMs: number,
  timeoutMs: number
): Promise<RawPolymarketMarket[]> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      const payload = await fetchJsonWithTimeout(url, timeoutMs);
      if (!Array.isArray(payload)) {
        throw new Error("Polymarket response is not an array");
      }
      return payload as RawPolymarketMarket[];
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }
      await sleep(retryBackoffMs * (attempt + 1));
      attempt += 1;
    }
  }

  throw new Error(`Failed to fetch Polymarket markets after ${retries + 1} attempts: ${String(lastError)}`);
}

function isLikelyActiveMarket(market: RawPolymarketMarket): boolean {
  if (market.active === false) {
    return false;
  }
  if (market.closed === true) {
    return false;
  }
  if (market.archived === true) {
    return false;
  }
  return true;
}

async function fetchActiveMarkets(options: FetchOptions): Promise<ActiveMarketsFetchResult> {
  const seenIds = new Set<string>();
  const markets: RawPolymarketMarket[] = [];
  let pagesFetched = 0;

  for (let page = 0; page < options.maxPages; page += 1) {
    const offset = page * options.limitPerPage;
    const url = buildPageUrl(options.baseUrl, options.limitPerPage, offset);
    const pageData = await fetchPageWithRetry(url, options.retries, options.retryBackoffMs, options.requestTimeoutMs);
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

    if (pageData.length < options.limitPerPage) {
      break;
    }
  }

  return { markets, pagesFetched };
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

function extractEventTags(raw: RawPolymarketMarket): string[] {
  if (!Array.isArray(raw.events)) {
    return [];
  }
  const allTags = raw.events.flatMap((event) => normalizeTags(event.tags));
  return [...new Set(allTags)];
}

function inferMarketUrl(raw: RawPolymarketMarket, id: string): string {
  const directUrl = asStringOrNull(raw.url);
  if (directUrl) {
    return directUrl;
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

function normalizeMarket(raw: RawPolymarketMarket): Market {
  const idValue = raw.id ?? raw.marketId;
  if (idValue === null || idValue === undefined || String(idValue).trim() === "") {
    throw new Error("Market id missing");
  }

  const question = asStringOrNull(raw.question) ?? asStringOrNull(raw.title);
  if (!question) {
    throw new Error("Market question missing");
  }

  const id = String(idValue).trim();
  const directTags = normalizeTags(raw.tags);
  const eventTags = extractEventTags(raw);

  return {
    id,
    question,
    description: asStringOrNull(raw.description),
    url: inferMarketUrl(raw, id),
    endDate: asStringOrNull(raw.endDate) ?? asStringOrNull(raw.end_date) ?? asStringOrNull(raw.resolutionDate),
    liquidity: asNumberOrNull(raw.liquidity ?? raw.liquidityNum),
    volume: asNumberOrNull(raw.volume ?? raw.volumeNum),
    openInterest: asNumberOrNull(raw.openInterest ?? raw.open_interest ?? raw.events?.[0]?.openInterest),
    tags: [...new Set([...directTags, ...eventTags])],
    createdAt: asStringOrNull(raw.createdAt),
    updatedAt: asStringOrNull(raw.updatedAt),
  };
}

function normalizeActiveMarkets(rawMarkets: RawPolymarketMarket[]): NormalizationResult {
  const markets: Market[] = [];
  let dropped = 0;

  for (const raw of rawMarkets) {
    try {
      markets.push(normalizeMarket(raw));
    } catch {
      dropped += 1;
    }
  }

  return { markets, dropped };
}

function toCorpus(market: Market): string {
  return `${market.question} ${market.description ?? ""} ${market.tags.join(" ")}`.toLowerCase();
}

function isExcludedByToken(corpus: string): string | null {
  const token = EXCLUSION_TOKENS.find((item) => corpus.includes(item));
  return token ? `excluded_${token.replace(/\s+/g, "_")}` : null;
}

function detectCategory(corpus: string): MarketCategory {
  for (const [category, keywords] of Object.entries(CATEGORY_MAP) as [MarketCategory, string[]][]) {
    if (category === "other") {
      continue;
    }
    if (keywords.some((keyword) => corpus.includes(keyword))) {
      return category;
    }
  }
  return "other";
}

function scoreNewsworthiness(market: Market): number {
  let score = 0;
  if ((market.volume ?? 0) >= 10000) {
    score += 1;
  }
  if ((market.liquidity ?? 0) >= 5000) {
    score += 1;
  }
  if ((market.openInterest ?? 0) >= 2500) {
    score += 1;
  }

  if (market.endDate) {
    const endTime = new Date(market.endDate).getTime();
    if (!Number.isNaN(endTime)) {
      const daysToResolve = (endTime - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysToResolve >= 0 && daysToResolve <= 14) {
        score += 1;
      }
    }
  }
  return score;
}

function scoreCivicRelevance(corpus: string, category: MarketCategory): number {
  let score = 0;
  const keywords = CATEGORY_MAP[category];

  if (category !== "other") {
    score += 1;
  }
  for (const token of keywords) {
    if (corpus.includes(token)) {
      score += 1;
    }
  }
  return score;
}

function createScoreBreakdown(market: Market): MarketScoreBreakdown {
  const corpus = toCorpus(market);
  const category = detectCategory(corpus);
  const civicScore = scoreCivicRelevance(corpus, category);
  const newsworthinessScore = scoreNewsworthiness(market);
  const reasonCodes: string[] = [];

  if (category !== "other") {
    reasonCodes.push(`category_${category}`);
  }
  if (newsworthinessScore > 0) {
    reasonCodes.push("news_signal_volume_or_liquidity");
  }

  return {
    civicScore,
    newsworthinessScore,
    category,
    reasonCodes,
  };
}

function curateMarkets(markets: Market[]): CurationResult {
  const curated: CuratedFeedItem[] = [];
  const rejected: CuratedFeedItem[] = [];
  const civicThreshold = 2;
  const newsThreshold = 1;

  for (const market of markets) {
    const corpus = toCorpus(market);
    const exclusionReason = isExcludedByToken(corpus);
    const score = createScoreBreakdown(market);

    let isCurated = false;
    let decisionReason = "excluded_below_threshold";

    if (exclusionReason) {
      decisionReason = exclusionReason;
    } else if (score.civicScore >= civicThreshold && score.newsworthinessScore >= newsThreshold) {
      isCurated = true;
      decisionReason = "included_civic_and_news_threshold_met";
    }

    const item: CuratedFeedItem = {
      ...market,
      isCurated,
      decisionReason,
      score,
    };

    if (isCurated) {
      curated.push(item);
    } else {
      rejected.push(item);
    }
  }

  curated.sort((a, b) => b.score.civicScore + b.score.newsworthinessScore - (a.score.civicScore + a.score.newsworthinessScore));
  return { curated, rejected };
}

async function runBatchInChunks(db: D1Database, statements: D1PreparedStatement[], chunkSize = 50): Promise<void> {
  for (let i = 0; i < statements.length; i += chunkSize) {
    const chunk = statements.slice(i, i + chunkSize);
    if (chunk.length > 0) {
      await db.batch(chunk);
    }
  }
}

async function replaceCuratedFeedSnapshot(
  db: D1Database,
  runId: string,
  fetchedAt: string,
  pagesFetched: number,
  rawCount: number,
  normalizedCount: number,
  droppedCount: number,
  items: CuratedFeedItem[]
): Promise<void> {
  await db.prepare("DELETE FROM curated_feed").run();

  const insertSql = `
    INSERT INTO curated_feed (
      market_id,
      question,
      description,
      url,
      end_date,
      liquidity,
      volume,
      open_interest,
      category,
      civic_score,
      newsworthiness_score,
      is_curated,
      decision_reason,
      reason_codes_json,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const statements = items.map((item) =>
    db
      .prepare(insertSql)
      .bind(
        item.id,
        item.question,
        item.description,
        item.url,
        item.endDate,
        item.liquidity,
        item.volume,
        item.openInterest,
        item.score.category,
        item.score.civicScore,
        item.score.newsworthinessScore,
        item.isCurated ? 1 : 0,
        item.decisionReason,
        JSON.stringify(item.score.reasonCodes),
        item.createdAt,
        item.updatedAt
      )
  );

  await runBatchInChunks(db, statements, 50);

  await db
    .prepare(
      `
      INSERT INTO ingestion_runs (
        run_id, fetched_at, pages_fetched, raw_count, normalized_count, dropped_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(run_id) DO UPDATE SET
        fetched_at = excluded.fetched_at,
        pages_fetched = excluded.pages_fetched,
        raw_count = excluded.raw_count,
        normalized_count = excluded.normalized_count,
        dropped_count = excluded.dropped_count
    `
    )
    .bind(runId, fetchedAt, pagesFetched, rawCount, normalizedCount, droppedCount, new Date().toISOString())
    .run();

  await db
    .prepare(
      `
      INSERT INTO latest_state (id, run_id, updated_at)
      VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        run_id = excluded.run_id,
        updated_at = excluded.updated_at
    `
    )
    .bind(runId, new Date().toISOString())
    .run();
}

export async function getFeedCounts(db: D1Database): Promise<FeedCounts> {
  const row = await db
    .prepare(
      `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN is_curated = 1 THEN 1 ELSE 0 END) AS curated,
        SUM(CASE WHEN is_curated = 0 THEN 1 ELSE 0 END) AS rejected
      FROM curated_feed
    `
    )
    .first<{ total: number; curated: number | null; rejected: number | null }>();

  return {
    total: Number(row?.total ?? 0),
    curated: Number(row?.curated ?? 0),
    rejected: Number(row?.rejected ?? 0),
  };
}

export async function refreshCuratedFeed(env: RefreshEnv): Promise<RefreshSummary> {
  const started = Date.now();
  const fetchStarted = Date.now();
  const fetchOptions = resolveFetchOptions(env);
  const fetched = await fetchActiveMarkets(fetchOptions);
  const fetchMs = Date.now() - fetchStarted;

  const normalizeStarted = Date.now();
  const normalized = normalizeActiveMarkets(fetched.markets);
  const curation = curateMarkets(normalized.markets);
  const normalizeMs = Date.now() - normalizeStarted;

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const fetchedAt = new Date().toISOString();
  const allItems = [...curation.curated, ...curation.rejected];

  const persistStarted = Date.now();
  await replaceCuratedFeedSnapshot(
    env.DB,
    runId,
    fetchedAt,
    fetched.pagesFetched,
    fetched.markets.length,
    normalized.markets.length,
    normalized.dropped,
    allItems
  );
  const persistMs = Date.now() - persistStarted;

  return {
    runId,
    fetchedAt,
    pagesFetched: fetched.pagesFetched,
    rawCount: fetched.markets.length,
    normalizedCount: normalized.markets.length,
    droppedCount: normalized.dropped,
    curatedCount: curation.curated.length,
    rejectedCount: curation.rejected.length,
    metrics: {
      totalMs: Date.now() - started,
      fetchMs,
      normalizeMs,
      persistMs,
    },
  };
}
