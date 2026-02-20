type MarketCategory =
  | "politics"
  | "economy"
  | "policy"
  | "geopolitics"
  | "public_health"
  | "climate_energy"
  | "tech_ai"
  | "sports"
  | "entertainment"
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
  frontPageScore: number;
}

interface RawPolymarketMarket {
  id?: string | number;
  marketId?: string | number;
  slug?: string;
  url?: string;
  question?: string;
  title?: string;
  description?: string;
  startDate?: string;
  start_date?: string;
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
  COASENSUS_BOUNCER_MIN_VOLUME?: string;
  COASENSUS_BOUNCER_MIN_LIQUIDITY?: string;
  COASENSUS_BOUNCER_MIN_HOURS_TO_END?: string;
  COASENSUS_BOUNCER_MAX_MARKET_AGE_DAYS?: string;
  COASENSUS_LLM_ENABLED?: string;
  COASENSUS_LLM_PROVIDER?: string;
  COASENSUS_LLM_MODEL?: string;
  COASENSUS_LLM_BASE_URL?: string;
  COASENSUS_LLM_API_KEY?: string;
  COASENSUS_LLM_PROMPT_VERSION?: string;
  COASENSUS_LLM_MIN_NEWS_SCORE?: string;
  COASENSUS_LLM_MIN_NEWS_SCORE_SPORTS?: string;
  COASENSUS_LLM_MIN_NEWS_SCORE_ENTERTAINMENT?: string;
  COASENSUS_LLM_MAX_MARKETS_PER_RUN?: string;
  COASENSUS_FRONTPAGE_W1?: string;
  COASENSUS_FRONTPAGE_W2?: string;
  COASENSUS_FRONTPAGE_W3?: string;
  COASENSUS_FRONTPAGE_LAMBDA?: string;
}

interface FetchOptions {
  baseUrl: string;
  limitPerPage: number;
  maxPages: number;
  requestTimeoutMs: number;
  retries: number;
  retryBackoffMs: number;
  minVolume: number;
  minLiquidity: number;
  minHoursToEnd: number;
  maxMarketAgeDays: number;
}

interface ActiveMarketsFetchResult {
  markets: RawPolymarketMarket[];
  pagesFetched: number;
  droppedByBouncer: number;
}

interface NormalizationResult {
  markets: Market[];
  dropped: number;
}

interface CurationResult {
  curated: CuratedFeedItem[];
  rejected: CuratedFeedItem[];
}

interface FrontPageRankingConfig {
  w1: number;
  w2: number;
  w3: number;
  lambda: number;
}

interface SemanticClassification {
  isMeme: boolean;
  newsworthinessScore: number;
  category: MarketCategory;
  geoTag: string;
  confidence: number;
  modelName: string;
  promptVersion: string;
  source: "llm" | "heuristic" | "cache";
}

type LlmProvider = "openai" | "gemini";

interface CachedSemanticRow {
  market_id: string;
  prompt_version: string;
  fingerprint: string;
  is_meme: number;
  newsworthiness_score: number;
  category: string;
  geo_tag: string;
  confidence: number | null;
  model_name: string;
  raw_json: string;
}

interface SemanticEnrichmentResult {
  byMarketId: Map<string, SemanticClassification>;
  metrics: {
    llmEnabled: boolean;
    llmProvider: LlmProvider;
    llmModel: string;
    promptVersion: string;
    cacheHits: number;
    cacheMisses: number;
    llmAttempts: number;
    llmEvaluated: number;
    heuristicEvaluated: number;
    llmFailures: number;
    llmErrorSamples: string[];
  };
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
  bouncerDroppedCount: number;
  normalizedCount: number;
  droppedCount: number;
  curatedCount: number;
  rejectedCount: number;
  semantic: {
    llmEnabled: boolean;
    llmProvider: LlmProvider;
    llmModel: string;
    promptVersion: string;
    cacheHits: number;
    cacheMisses: number;
    llmAttempts: number;
    llmEvaluated: number;
    heuristicEvaluated: number;
    llmFailures: number;
    llmErrorSamples: string[];
  };
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
  minVolume: 10_000,
  minLiquidity: 5_000,
  minHoursToEnd: 2,
  maxMarketAgeDays: 365,
};

const DEFAULT_LLM_MODEL = "gpt-4o-mini";
const DEFAULT_LLM_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_LLM_PROVIDER = "openai";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_LLM_PROMPT_VERSION = "v1";
const DEFAULT_LLM_MIN_NEWS_SCORE = 55;
const DEFAULT_LLM_MIN_NEWS_SCORE_SPORTS = 72;
const DEFAULT_LLM_MIN_NEWS_SCORE_ENTERTAINMENT = 78;
const DEFAULT_LLM_MAX_MARKETS_PER_RUN = 150;
const DEFAULT_FRONTPAGE_W1 = 0.6;
const DEFAULT_FRONTPAGE_W2 = 0.25;
const DEFAULT_FRONTPAGE_W3 = 0.1;
const DEFAULT_FRONTPAGE_LAMBDA = 0.02;

const EXCLUSION_TOKENS = [
  "meme",
  "doge",
  "pepe",
  "gossip",
  "celebrity",
  "james bond",
  "oscar",
  "grammy",
  "box office",
  "movie",
  "tv show",
  "super bowl",
  "world cup",
  "championship",
  "tournament",
  "masters",
  "golf",
  "tennis",
  "formula 1",
  "f1",
  "basketball",
  "football",
  "baseball",
  "hockey",
  "nba",
  "nfl",
  "soccer",
  "mlb",
  "nhl",
  "ufc",
  "crypto memecoin",
];

const STRICT_EXCLUSION_TOKENS = ["meme", "doge", "pepe", "crypto memecoin", "gossip"];

const CATEGORY_MAP: Record<MarketCategory, string[]> = {
  politics: ["election", "vote", "senate", "house", "president", "prime minister"],
  economy: ["inflation", "gdp", "recession", "unemployment", "federal reserve", "interest rate"],
  policy: ["bill", "law", "regulation", "policy", "court", "supreme court"],
  geopolitics: ["war", "conflict", "ceasefire", "sanction", "nato", "china", "russia", "taiwan"],
  public_health: ["pandemic", "vaccine", "cdc", "outbreak", "public health", "hospital", "epidemic"],
  climate_energy: ["climate", "emissions", "oil", "gas", "renewable", "energy", "carbon"],
  tech_ai: ["ai", "artificial intelligence", "openai", "anthropic", "google", "chip", "gpu", "robotics"],
  sports: ["sports", "tournament", "league", "championship", "playoff", "final"],
  entertainment: ["movie", "music", "celebrity", "award", "oscar", "grammy", "tv"],
  other: [],
};

function asPositiveInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function asBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function asFiniteNumber(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function resolveFrontPageRankingConfig(env: RefreshEnv): FrontPageRankingConfig {
  return {
    w1: asFiniteNumber(env.COASENSUS_FRONTPAGE_W1, DEFAULT_FRONTPAGE_W1, 0, 10),
    w2: asFiniteNumber(env.COASENSUS_FRONTPAGE_W2, DEFAULT_FRONTPAGE_W2, 0, 10),
    w3: asFiniteNumber(env.COASENSUS_FRONTPAGE_W3, DEFAULT_FRONTPAGE_W3, 0, 10),
    lambda: asFiniteNumber(env.COASENSUS_FRONTPAGE_LAMBDA, DEFAULT_FRONTPAGE_LAMBDA, 0, 10),
  };
}

function parseTimestampMs(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function computeDeltaHours(market: Market, nowMs: number): number {
  const ts = parseTimestampMs(market.updatedAt) ?? parseTimestampMs(market.createdAt);
  if (ts === null) {
    return 0;
  }
  const deltaMs = Math.max(0, nowMs - ts);
  return deltaMs / (1000 * 60 * 60);
}

function computeFrontPageScore(
  market: Market,
  newsworthinessScore: number,
  config: FrontPageRankingConfig,
  nowMs: number
): number {
  const sLlm = Math.max(0, Math.min(100, newsworthinessScore)) / 100;
  const volume = Math.max(0, market.volume ?? 0);
  const liquidity = Math.max(0, market.liquidity ?? 0);
  const deltaHours = computeDeltaHours(market, nowMs);
  const score =
    config.w1 * sLlm +
    config.w2 * Math.log(volume + 1) +
    config.w3 * Math.log(liquidity + 1) -
    config.lambda * deltaHours;
  return Number(score.toFixed(6));
}

function normalizeGeoTag(value: string | null | undefined): string {
  const candidate = (value ?? "").trim();
  if (!candidate || candidate.toLowerCase() === "undefined" || candidate.toLowerCase() === "null") {
    return "World";
  }
  return candidate;
}

function toMarketCategory(value: string): MarketCategory {
  const normalized = value.trim().toLowerCase().replace(/[\s/]+/g, "_");
  if (
    normalized === "politics" ||
    normalized === "economy" ||
    normalized === "policy" ||
    normalized === "geopolitics" ||
    normalized === "public_health" ||
    normalized === "climate_energy" ||
    normalized === "tech_ai" ||
    normalized === "sports" ||
    normalized === "entertainment" ||
    normalized === "other"
  ) {
    return normalized;
  }

  if (normalized === "tech" || normalized === "ai" || normalized === "science") {
    return "tech_ai";
  }
  if (normalized === "public_health" || normalized === "health") {
    return "public_health";
  }
  if (normalized === "climate" || normalized === "energy" || normalized === "climate_and_energy") {
    return "climate_energy";
  }
  if (normalized === "culture") {
    return "entertainment";
  }
  if (normalized === "world" || normalized === "global") {
    return "other";
  }

  return "other";
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
    minVolume: asPositiveInt(env.COASENSUS_BOUNCER_MIN_VOLUME, DEFAULT_FETCH_OPTIONS.minVolume, 0, 1_000_000_000),
    minLiquidity: asPositiveInt(
      env.COASENSUS_BOUNCER_MIN_LIQUIDITY,
      DEFAULT_FETCH_OPTIONS.minLiquidity,
      0,
      1_000_000_000
    ),
    minHoursToEnd: asPositiveInt(
      env.COASENSUS_BOUNCER_MIN_HOURS_TO_END,
      DEFAULT_FETCH_OPTIONS.minHoursToEnd,
      0,
      24 * 30
    ),
    maxMarketAgeDays: asPositiveInt(
      env.COASENSUS_BOUNCER_MAX_MARKET_AGE_DAYS,
      DEFAULT_FETCH_OPTIONS.maxMarketAgeDays,
      1,
      3650
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

function resolveLlmProvider(env: RefreshEnv): LlmProvider {
  const value = env.COASENSUS_LLM_PROVIDER?.trim().toLowerCase() || DEFAULT_LLM_PROVIDER;
  return value === "gemini" ? "gemini" : "openai";
}

function resolveLlmModel(env: RefreshEnv, provider: LlmProvider): string {
  const configured = env.COASENSUS_LLM_MODEL?.trim();
  if (configured) {
    return configured;
  }
  return provider === "gemini" ? DEFAULT_GEMINI_MODEL : DEFAULT_LLM_MODEL;
}

function normalizeErrorDetail(detail: string): string {
  const compact = detail.replace(/\s+/g, " ").trim();
  if (compact.length <= 500) {
    return compact;
  }
  return `${compact.slice(0, 500)}...`;
}

async function readHttpErrorDetail(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) {
      return "";
    }
    return normalizeErrorDetail(text);
  } catch {
    return "";
  }
}

function buildPageUrl(baseUrl: string, options: FetchOptions, offset: number): string {
  const url = new URL(`${normalizeBaseUrl(baseUrl)}/markets`);
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("archived", "false");
  url.searchParams.set("limit", String(options.limitPerPage));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("volume_num_min", String(options.minVolume));
  url.searchParams.set("liquidity_num_min", String(options.minLiquidity));

  const now = Date.now();
  const earliestStartMs = now - options.maxMarketAgeDays * 24 * 60 * 60 * 1000;
  const minEndMs = now + options.minHoursToEnd * 60 * 60 * 1000;
  url.searchParams.set("start_date_min", new Date(earliestStartMs).toISOString());
  url.searchParams.set("end_date_min", new Date(minEndMs).toISOString());

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

function asDateMsOrNull(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function passesBouncer(market: RawPolymarketMarket, options: FetchOptions): boolean {
  const volume = asNumberOrNull(market.volume ?? market.volumeNum) ?? 0;
  const liquidity = asNumberOrNull(market.liquidity ?? market.liquidityNum) ?? 0;
  if (volume < options.minVolume) {
    return false;
  }
  if (liquidity < options.minLiquidity) {
    return false;
  }

  const now = Date.now();
  const minEndMs = now + options.minHoursToEnd * 60 * 60 * 1000;
  const endMs = asDateMsOrNull(market.endDate) ?? asDateMsOrNull(market.end_date) ?? asDateMsOrNull(market.resolutionDate);
  if (endMs !== null && endMs < minEndMs) {
    return false;
  }

  const earliestStartMs = now - options.maxMarketAgeDays * 24 * 60 * 60 * 1000;
  const startMs =
    asDateMsOrNull(market.startDate) ?? asDateMsOrNull(market.start_date) ?? asDateMsOrNull(market.createdAt);
  if (startMs !== null && startMs < earliestStartMs) {
    return false;
  }

  return true;
}

async function fetchActiveMarkets(options: FetchOptions): Promise<ActiveMarketsFetchResult> {
  const seenIds = new Set<string>();
  const markets: RawPolymarketMarket[] = [];
  let pagesFetched = 0;
  let droppedByBouncer = 0;

  for (let page = 0; page < options.maxPages; page += 1) {
    const offset = page * options.limitPerPage;
    const url = buildPageUrl(options.baseUrl, options, offset);
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
      if (!passesBouncer(market, options)) {
        droppedByBouncer += 1;
        continue;
      }
      seenIds.add(id);
      markets.push(market);
    }

    if (pageData.length < options.limitPerPage) {
      break;
    }
  }

  return { markets, pagesFetched, droppedByBouncer };
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

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function fingerprintMarket(market: Market, promptVersion: string): string {
  const input = `${promptVersion}|${market.question.toLowerCase()}|${(market.description ?? "").toLowerCase()}|${market.tags
    .join(",")
    .toLowerCase()}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function detectGeoTag(corpus: string): string {
  if (/\b(us|usa|united states|white house|congress|senate)\b/i.test(corpus)) {
    return "US";
  }
  if (/\b(eu|europe|uk|britain|germany|france|italy)\b/i.test(corpus)) {
    return "EU";
  }
  if (/\b(china|japan|korea|india|asia|taiwan)\b/i.test(corpus)) {
    return "Asia";
  }
  if (/\b(africa|nigeria|kenya|south africa|ethiopia)\b/i.test(corpus)) {
    return "Africa";
  }
  if (/\b(middle east|saudi|iran|israel|uae|qatar)\b/i.test(corpus)) {
    return "MiddleEast";
  }
  return "World";
}

function buildSemanticRawPayload(classification: SemanticClassification): string {
  return JSON.stringify({
    is_meme: classification.isMeme,
    newsworthiness_score: classification.newsworthinessScore,
    category: classification.category,
    geo_tag: classification.geoTag,
    confidence: classification.confidence,
  });
}

function normalizeSemanticPayload(
  payload: Record<string, unknown>,
  modelName: string,
  promptVersion: string,
  source: SemanticClassification["source"]
): SemanticClassification {
  const isMeme = payload.is_meme === true || payload.isMeme === true;
  const rawScore = Number(payload.newsworthiness_score ?? payload.newsworthinessScore ?? 50);
  const newsworthinessScore = clampInt(Number.isFinite(rawScore) ? rawScore : 50, 1, 100);
  const category = toMarketCategory(String(payload.category ?? "other"));
  const geoTag = normalizeGeoTag(String(payload.geo_tag ?? payload.geoTag ?? "World"));
  const rawConfidence = Number(payload.confidence ?? 0.5);
  const confidence = Number.isFinite(rawConfidence) ? Math.max(0, Math.min(1, rawConfidence)) : 0.5;

  return {
    isMeme,
    newsworthinessScore,
    category,
    geoTag,
    confidence,
    modelName,
    promptVersion,
    source,
  };
}

function heuristicSemanticClassification(market: Market, promptVersion: string): SemanticClassification {
  const corpus = toCorpus(market);
  const exclusionReason = isExcludedByToken(corpus);
  const detected = detectCategory(corpus);
  const baseNews = scoreNewsworthiness(market);
  const boosted = baseNews * 20 + (detected.category !== "other" ? 10 : 0);
  const newsworthinessScore = clampInt(boosted, 1, 100);

  return {
    isMeme: exclusionReason !== null,
    newsworthinessScore,
    category: detected.category,
    geoTag: detectGeoTag(corpus),
    confidence: 0.45,
    modelName: "heuristic-v1",
    promptVersion,
    source: "heuristic",
  };
}

function semanticJsonSchema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      is_meme: { type: "boolean" },
      newsworthiness_score: { type: "integer", minimum: 1, maximum: 100 },
      category: {
        type: "string",
        enum: [
          "politics",
          "economy",
          "policy",
          "geopolitics",
          "public_health",
          "climate_energy",
          "tech_ai",
          "sports",
          "entertainment",
          "other",
        ],
      },
      geo_tag: {
        type: "string",
        enum: ["US", "EU", "Asia", "Africa", "MiddleEast", "World"],
      },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
    required: ["is_meme", "newsworthiness_score", "category", "geo_tag", "confidence"],
  };
}

async function classifyMarketWithOpenAI(
  env: RefreshEnv,
  market: Market,
  promptVersion: string
): Promise<SemanticClassification> {
  const apiKey = env.COASENSUS_LLM_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("LLM enabled but COASENSUS_LLM_API_KEY missing");
  }

  const model = resolveLlmModel(env, "openai");
  const baseUrl = normalizeBaseUrl(env.COASENSUS_LLM_BASE_URL?.trim() || DEFAULT_LLM_BASE_URL);
  const systemPrompt =
    "You are the Editor-in-Chief for a predictive news feed. Return JSON only. Classify if market is meme/noise, assign newsworthiness score (1-100), category, geo tag, and confidence.";
  const userPayload = {
    prompt_version: promptVersion,
    market: {
      id: market.id,
      question: market.question,
      description: market.description,
      tags: market.tags,
      liquidity: market.liquidity,
      volume: market.volume,
      open_interest: market.openInterest,
      end_date: market.endDate,
    },
  };

  const body = {
    model,
    temperature: 0,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: JSON.stringify(userPayload),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "coasensus_semantic_market",
        strict: true,
        schema: semanticJsonSchema(),
      },
    },
  };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await readHttpErrorDetail(response);
    throw new Error(`OpenAI HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  };
  const messageContent = payload.choices?.[0]?.message?.content;
  const content =
    typeof messageContent === "string"
      ? messageContent
      : Array.isArray(messageContent)
        ? messageContent
            .map((part) => (typeof part?.text === "string" ? part.text : ""))
            .join("\n")
            .trim()
        : "";
  if (!content) {
    throw new Error("LLM response missing message content");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parseSemanticJsonText(content);
  } catch {
    throw new Error("LLM response was not valid JSON");
  }

  return normalizeSemanticPayload(parsed, model, promptVersion, "llm");
}

function parseSemanticJsonText(content: string): Record<string, unknown> {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || trimmed;
  try {
    const parsed = JSON.parse(candidate) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    const first = candidate.indexOf("{");
    const last = candidate.lastIndexOf("}");
    if (first >= 0 && last > first) {
      const sliced = candidate.slice(first, last + 1);
      try {
        const reparsed = JSON.parse(sliced) as unknown;
        if (reparsed && typeof reparsed === "object" && !Array.isArray(reparsed)) {
          return reparsed as Record<string, unknown>;
        }
      } catch {
        // fall through and raise a single parse error below
      }
    }
  }
  throw new Error("Invalid JSON content");
}

async function classifyMarketWithGemini(
  env: RefreshEnv,
  market: Market,
  promptVersion: string
): Promise<SemanticClassification> {
  const apiKey = env.COASENSUS_LLM_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("LLM enabled but COASENSUS_LLM_API_KEY missing");
  }
  const model = resolveLlmModel(env, "gemini");
  const baseUrl = normalizeBaseUrl(env.COASENSUS_LLM_BASE_URL?.trim() || DEFAULT_GEMINI_BASE_URL);
  const promptText = [
    "You are the Editor-in-Chief for a predictive news feed.",
    "Return JSON only with this exact shape:",
    '{ "is_meme": boolean, "newsworthiness_score": number(1..100), "category": "politics|economy|policy|geopolitics|public_health|climate_energy|tech_ai|sports|entertainment|other", "geo_tag": "US|EU|Asia|Africa|MiddleEast|World", "confidence": number(0..1) }',
    "Do not add markdown fences or commentary.",
    JSON.stringify({
      prompt_version: promptVersion,
      market: {
        id: market.id,
        question: market.question,
        description: market.description,
        tags: market.tags,
        liquidity: market.liquidity,
        volume: market.volume,
        open_interest: market.openInterest,
        end_date: market.endDate,
      },
    }),
  ].join("\n");

  const response = await fetch(`${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: promptText }],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const detail = await readHttpErrorDetail(response);
    throw new Error(`Gemini HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!content) {
    throw new Error("Gemini response missing content");
  }
  const parsed = parseSemanticJsonText(content);

  return normalizeSemanticPayload(parsed, model, promptVersion, "llm");
}

async function classifyMarketSemantic(env: RefreshEnv, market: Market, promptVersion: string): Promise<SemanticClassification> {
  let lastError: unknown;
  const retries = 1;
  const provider = resolveLlmProvider(env);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      if (provider === "gemini") {
        return await classifyMarketWithGemini(env, market, promptVersion);
      }
      return await classifyMarketWithOpenAI(env, market, promptVersion);
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(250 * (attempt + 1));
      }
    }
  }

  throw new Error(`LLM classification failed: ${String(lastError)}`);
}

async function loadSemanticCache(db: D1Database, marketIds: string[]): Promise<Map<string, CachedSemanticRow>> {
  const map = new Map<string, CachedSemanticRow>();
  const chunkSize = 80;

  try {
    for (let i = 0; i < marketIds.length; i += chunkSize) {
      const chunk = marketIds.slice(i, i + chunkSize);
      if (chunk.length === 0) {
        continue;
      }
      const placeholders = chunk.map(() => "?").join(", ");
      const sql = `
        SELECT
          market_id,
          prompt_version,
          fingerprint,
          is_meme,
          newsworthiness_score,
          category,
          geo_tag,
          confidence,
          model_name,
          raw_json
        FROM semantic_market_cache
        WHERE market_id IN (${placeholders})
      `;

      const rows = await db.prepare(sql).bind(...chunk).all<CachedSemanticRow>();
      for (const row of rows.results ?? []) {
        map.set(row.market_id, row);
      }
    }
  } catch (error) {
    console.error("Semantic cache read failed, falling back to live classification", error);
  }

  return map;
}

function classificationFromCacheRow(row: CachedSemanticRow): SemanticClassification {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(row.raw_json) as Record<string, unknown>;
  } catch {
    payload = {};
  }
  payload.is_meme = row.is_meme === 1;
  payload.newsworthiness_score = row.newsworthiness_score;
  payload.category = row.category;
  payload.geo_tag = row.geo_tag;
  payload.confidence = row.confidence ?? payload.confidence;
  return normalizeSemanticPayload(payload, row.model_name, row.prompt_version, "cache");
}

async function upsertSemanticCache(
  db: D1Database,
  rows: Array<{
    marketId: string;
    promptVersion: string;
    fingerprint: string;
    classification: SemanticClassification;
  }>
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const sql = `
    INSERT INTO semantic_market_cache (
      market_id,
      prompt_version,
      fingerprint,
      is_meme,
      newsworthiness_score,
      category,
      geo_tag,
      confidence,
      model_name,
      raw_json,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(market_id) DO UPDATE SET
      prompt_version = excluded.prompt_version,
      fingerprint = excluded.fingerprint,
      is_meme = excluded.is_meme,
      newsworthiness_score = excluded.newsworthiness_score,
      category = excluded.category,
      geo_tag = excluded.geo_tag,
      confidence = excluded.confidence,
      model_name = excluded.model_name,
      raw_json = excluded.raw_json,
      updated_at = excluded.updated_at
  `;

  const nowIso = new Date().toISOString();
  const statements = rows.map((row) =>
    db
      .prepare(sql)
      .bind(
        row.marketId,
        row.promptVersion,
        row.fingerprint,
        row.classification.isMeme ? 1 : 0,
        row.classification.newsworthinessScore,
        row.classification.category,
        row.classification.geoTag,
        row.classification.confidence,
        row.classification.modelName,
        buildSemanticRawPayload(row.classification),
        nowIso,
        nowIso
      )
  );

  try {
    await runBatchInChunks(db, statements, 25);
  } catch (error) {
    console.error("Semantic cache write failed", error);
  }
}

async function enrichMarketsWithSemanticCache(env: RefreshEnv, markets: Market[]): Promise<SemanticEnrichmentResult> {
  const promptVersion = env.COASENSUS_LLM_PROMPT_VERSION?.trim() || DEFAULT_LLM_PROMPT_VERSION;
  const llmProvider = resolveLlmProvider(env);
  const llmModel = resolveLlmModel(env, llmProvider);
  const llmConfigured = asBool(env.COASENSUS_LLM_ENABLED, false) && Boolean(env.COASENSUS_LLM_API_KEY?.trim());
  const maxLlmMarkets = asPositiveInt(
    env.COASENSUS_LLM_MAX_MARKETS_PER_RUN,
    DEFAULT_LLM_MAX_MARKETS_PER_RUN,
    0,
    2000
  );

  const byMarketId = new Map<string, SemanticClassification>();
  const cacheRows = await loadSemanticCache(
    env.DB,
    markets.map((market) => market.id)
  );

  const toClassify: Array<{ market: Market; fingerprint: string }> = [];
  let cacheHits = 0;

  for (const market of markets) {
    const fingerprint = fingerprintMarket(market, promptVersion);
    const cached = cacheRows.get(market.id);
    if (cached && cached.prompt_version === promptVersion && cached.fingerprint === fingerprint) {
      byMarketId.set(market.id, classificationFromCacheRow(cached));
      cacheHits += 1;
      continue;
    }
    toClassify.push({ market, fingerprint });
  }

  const cacheMisses = toClassify.length;
  const rowsToUpsert: Array<{
    marketId: string;
    promptVersion: string;
    fingerprint: string;
    classification: SemanticClassification;
  }> = [];

  let llmEvaluated = 0;
  let llmAttempts = 0;
  let heuristicEvaluated = 0;
  let llmFailures = 0;
  const llmErrorSamples: string[] = [];
  const llmQueue: Array<{ market: Market; fingerprint: string; priority: number }> = [];
  for (const candidate of toClassify) {
    const corpus = toCorpus(candidate.market);
    if (isStrictExcludedByToken(corpus)) {
      const classification = heuristicSemanticClassification(candidate.market, promptVersion);
      byMarketId.set(candidate.market.id, classification);
      rowsToUpsert.push({
        marketId: candidate.market.id,
        promptVersion,
        fingerprint: candidate.fingerprint,
        classification,
      });
      heuristicEvaluated += 1;
      continue;
    }
    llmQueue.push({
      market: candidate.market,
      fingerprint: candidate.fingerprint,
      priority: computeLlmCandidatePriority(candidate.market),
    });
  }

  llmQueue.sort((a, b) => b.priority - a.priority || a.market.id.localeCompare(b.market.id));

  for (const candidate of llmQueue) {
    let classification: SemanticClassification;

    if (llmConfigured && llmAttempts < maxLlmMarkets) {
      llmAttempts += 1;
      try {
        classification = await classifyMarketSemantic(env, candidate.market, promptVersion);
        llmEvaluated += 1;
      } catch (error) {
        llmFailures += 1;
        const message = error instanceof Error ? error.message : String(error);
        if (llmErrorSamples.length < 5) {
          llmErrorSamples.push(message);
        }
        console.error("LLM classify failed, using heuristic fallback", {
          provider: llmProvider,
          model: llmModel,
          message,
        });
        classification = heuristicSemanticClassification(candidate.market, promptVersion);
        heuristicEvaluated += 1;
      }
    } else {
      classification = heuristicSemanticClassification(candidate.market, promptVersion);
      heuristicEvaluated += 1;
    }

    byMarketId.set(candidate.market.id, classification);
    rowsToUpsert.push({
      marketId: candidate.market.id,
      promptVersion,
      fingerprint: candidate.fingerprint,
      classification,
    });
  }

  await upsertSemanticCache(env.DB, rowsToUpsert);

  return {
    byMarketId,
    metrics: {
      llmEnabled: llmConfigured,
      llmProvider,
      llmModel,
      promptVersion,
      cacheHits,
      cacheMisses,
      llmAttempts,
      llmEvaluated,
      heuristicEvaluated,
      llmFailures,
      llmErrorSamples,
    },
  };
}

function toCorpus(market: Market): string {
  return `${market.question} ${market.description ?? ""} ${market.tags.join(" ")}`.toLowerCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keywordPattern(keyword: string): RegExp {
  const escaped = escapeRegex(keyword.toLowerCase()).replace(/\\\s+/g, "\\s+");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

function hasKeyword(corpus: string, keyword: string): boolean {
  return keywordPattern(keyword).test(corpus);
}

function matchedKeywords(corpus: string, keywords: string[]): string[] {
  return keywords.filter((keyword) => hasKeyword(corpus, keyword));
}

function isExcludedByToken(corpus: string): string | null {
  const token = EXCLUSION_TOKENS.find((item) => hasKeyword(corpus, item));
  return token ? `excluded_${token.replace(/\s+/g, "_")}` : null;
}

function isStrictExcludedByToken(corpus: string): string | null {
  const token = STRICT_EXCLUSION_TOKENS.find((item) => hasKeyword(corpus, item));
  return token ? `excluded_${token.replace(/\s+/g, "_")}` : null;
}

function detectCategory(corpus: string): { category: MarketCategory; keywords: string[] } {
  let bestCategory: MarketCategory = "other";
  let bestKeywords: string[] = [];

  for (const [category, keywords] of Object.entries(CATEGORY_MAP) as [MarketCategory, string[]][]) {
    if (category === "other") {
      continue;
    }
    const matches = matchedKeywords(corpus, keywords);
    if (matches.length > bestKeywords.length) {
      bestCategory = category;
      bestKeywords = matches;
    }
  }

  return { category: bestCategory, keywords: bestKeywords };
}

function scoreNewsworthiness(market: Market): number {
  let score = 0;
  if ((market.volume ?? 0) >= 25000) {
    score += 1;
  }
  if ((market.liquidity ?? 0) >= 10000) {
    score += 1;
  }
  if ((market.openInterest ?? 0) >= 5000) {
    score += 1;
  }
  if ((market.volume ?? 0) >= 250000 || (market.liquidity ?? 0) >= 50000) {
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

function scoreCivicRelevance(category: MarketCategory, keywords: string[]): number {
  if (category !== "other") {
    return 1 + keywords.length;
  }
  return 0;
}

function createScoreBreakdown(market: Market, semantic: SemanticClassification): MarketScoreBreakdown {
  const corpus = toCorpus(market);
  const keywordMatches = matchedKeywords(corpus, CATEGORY_MAP[semantic.category] ?? []);
  const civicScore = scoreCivicRelevance(semantic.category, keywordMatches);
  const newsworthinessScore = clampInt(semantic.newsworthinessScore, 1, 100);
  const reasonCodes: string[] = [
    `semantic_source_${semantic.source}`,
    `semantic_category_${semantic.category}`,
    `geo_${semantic.geoTag.toLowerCase()}`,
  ];

  for (const keyword of keywordMatches.slice(0, 2)) {
    reasonCodes.push(`keyword_${keyword.replace(/\s+/g, "_")}`);
  }
  if (semantic.isMeme) {
    reasonCodes.push("semantic_meme_flag");
  }

  return {
    civicScore,
    newsworthinessScore,
    category: semantic.category,
    reasonCodes,
  };
}

function llmMinNewsScore(env: RefreshEnv): number {
  return asFiniteNumber(env.COASENSUS_LLM_MIN_NEWS_SCORE, DEFAULT_LLM_MIN_NEWS_SCORE, 1, 100);
}

function llmCategoryNewsScoreFloor(env: RefreshEnv, category: MarketCategory): number {
  const base = llmMinNewsScore(env);
  if (category === "sports") {
    const sportsFloor = asFiniteNumber(
      env.COASENSUS_LLM_MIN_NEWS_SCORE_SPORTS,
      DEFAULT_LLM_MIN_NEWS_SCORE_SPORTS,
      1,
      100
    );
    return Math.max(base, sportsFloor);
  }
  if (category === "entertainment") {
    const entertainmentFloor = asFiniteNumber(
      env.COASENSUS_LLM_MIN_NEWS_SCORE_ENTERTAINMENT,
      DEFAULT_LLM_MIN_NEWS_SCORE_ENTERTAINMENT,
      1,
      100
    );
    return Math.max(base, entertainmentFloor);
  }
  return base;
}

function computeLlmCandidatePriority(market: Market): number {
  const volume = Math.max(0, market.volume ?? 0);
  const liquidity = Math.max(0, market.liquidity ?? 0);
  const corpus = toCorpus(market);
  const detectedCategory = detectCategory(corpus);
  const categoryBonus = detectedCategory.category === "other" ? 0 : 1.5;
  const keywordBonus = Math.min(1, detectedCategory.keywords.length * 0.25);

  const nowMs = Date.now();
  const updatedMs = parseTimestampMs(market.updatedAt) ?? parseTimestampMs(market.createdAt);
  const recencyBonus =
    updatedMs === null ? 0 : Math.max(0, 1 - Math.min(180, (nowMs - updatedMs) / (1000 * 60 * 60 * 24)) / 180);

  const endMs = parseTimestampMs(market.endDate);
  let deadlineBonus = 0;
  if (endMs !== null) {
    const daysToEnd = (endMs - nowMs) / (1000 * 60 * 60 * 24);
    if (daysToEnd >= 0 && daysToEnd <= 14) {
      deadlineBonus = 1;
    } else if (daysToEnd < 0) {
      deadlineBonus = -1;
    }
  }

  const score =
    0.45 * Math.log(volume + 1) +
    0.35 * Math.log(liquidity + 1) +
    categoryBonus +
    keywordBonus +
    0.5 * recencyBonus +
    deadlineBonus;
  return Number(score.toFixed(6));
}

function curateMarkets(
  markets: Market[],
  semanticByMarketId: Map<string, SemanticClassification>,
  env: RefreshEnv,
  promptVersion: string
): CurationResult {
  const curated: CuratedFeedItem[] = [];
  const rejected: CuratedFeedItem[] = [];
  const civicThreshold = 2;
  const rankingConfig = resolveFrontPageRankingConfig(env);
  const rankingNowMs = Date.now();

  for (const market of markets) {
    const corpus = toCorpus(market);
    const exclusionReason = isStrictExcludedByToken(corpus);
    const semantic = semanticByMarketId.get(market.id) ?? heuristicSemanticClassification(market, promptVersion);
    const score = createScoreBreakdown(market, semantic);
    const frontPageScore = computeFrontPageScore(market, score.newsworthinessScore, rankingConfig, rankingNowMs);
    const categoryNewsThreshold = llmCategoryNewsScoreFloor(env, score.category);

    let isCurated = false;
    let decisionReason = "excluded_semantic_below_threshold";

    if (exclusionReason) {
      decisionReason = exclusionReason;
    } else if (semantic.isMeme) {
      decisionReason = "excluded_llm_meme";
    } else if (score.civicScore < civicThreshold) {
      decisionReason = "excluded_semantic_below_civic_threshold";
    } else if (score.newsworthinessScore < categoryNewsThreshold) {
      decisionReason = `excluded_semantic_news_threshold_${score.category}`;
    } else {
      isCurated = true;
      decisionReason = "included_semantic_threshold_met";
    }

    const item: CuratedFeedItem = {
      ...market,
      isCurated,
      decisionReason,
      score,
      frontPageScore,
    };

    if (isCurated) {
      curated.push(item);
    } else {
      rejected.push(item);
    }
  }

  curated.sort((a, b) => b.frontPageScore - a.frontPageScore || a.id.localeCompare(b.id));
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

async function curatedFeedHasColumn(db: D1Database, columnName: string): Promise<boolean> {
  try {
    const rows = await db.prepare("PRAGMA table_info(curated_feed)").all<{ name: string }>();
    return (rows.results ?? []).some((row) => row.name === columnName);
  } catch (error) {
    console.error("Failed to inspect curated_feed schema", error);
    return false;
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

  const hasFrontPageScore = await curatedFeedHasColumn(db, "front_page_score");

  const insertSql = hasFrontPageScore
    ? `
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
          front_page_score,
          is_curated,
          decision_reason,
          reason_codes_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    : `
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

  const statements = items.map((item) => {
    const common = [
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
    ];
    const tail = [
      item.isCurated ? 1 : 0,
      item.decisionReason,
      JSON.stringify(item.score.reasonCodes),
      item.createdAt,
      item.updatedAt,
    ];
    const bindings = hasFrontPageScore ? [...common, item.frontPageScore, ...tail] : [...common, ...tail];
    return db.prepare(insertSql).bind(...bindings);
  });

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

async function persistSemanticRunTelemetry(
  db: D1Database,
  summary: {
    runId: string;
    fetchedAt: string;
    pagesFetched: number;
    rawCount: number;
    normalizedCount: number;
    curatedCount: number;
    rejectedCount: number;
    bouncerDroppedCount: number;
    semantic: {
      llmEnabled: boolean;
      llmProvider: LlmProvider;
      llmModel: string;
      promptVersion: string;
      cacheHits: number;
      cacheMisses: number;
      llmEvaluated: number;
      heuristicEvaluated: number;
      llmFailures: number;
    };
    metrics: {
      totalMs: number;
      fetchMs: number;
      normalizeMs: number;
      persistMs: number;
    };
  }
): Promise<void> {
  const nowIso = new Date().toISOString();
  await db
    .prepare(
      `
      INSERT INTO semantic_refresh_runs (
        run_id,
        fetched_at,
        prompt_version,
        llm_enabled,
        llm_provider,
        llm_model,
        pages_fetched,
        raw_count,
        normalized_count,
        curated_count,
        rejected_count,
        bouncer_dropped_count,
        cache_hits,
        cache_misses,
        llm_evaluated,
        heuristic_evaluated,
        llm_failures,
        total_ms,
        fetch_ms,
        normalize_ms,
        persist_ms,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(run_id) DO UPDATE SET
        fetched_at = excluded.fetched_at,
        prompt_version = excluded.prompt_version,
        llm_enabled = excluded.llm_enabled,
        llm_provider = excluded.llm_provider,
        llm_model = excluded.llm_model,
        pages_fetched = excluded.pages_fetched,
        raw_count = excluded.raw_count,
        normalized_count = excluded.normalized_count,
        curated_count = excluded.curated_count,
        rejected_count = excluded.rejected_count,
        bouncer_dropped_count = excluded.bouncer_dropped_count,
        cache_hits = excluded.cache_hits,
        cache_misses = excluded.cache_misses,
        llm_evaluated = excluded.llm_evaluated,
        heuristic_evaluated = excluded.heuristic_evaluated,
        llm_failures = excluded.llm_failures,
        total_ms = excluded.total_ms,
        fetch_ms = excluded.fetch_ms,
        normalize_ms = excluded.normalize_ms,
        persist_ms = excluded.persist_ms
    `
    )
    .bind(
      summary.runId,
      summary.fetchedAt,
      summary.semantic.promptVersion,
      summary.semantic.llmEnabled ? 1 : 0,
      summary.semantic.llmProvider,
      summary.semantic.llmModel,
      summary.pagesFetched,
      summary.rawCount,
      summary.normalizedCount,
      summary.curatedCount,
      summary.rejectedCount,
      summary.bouncerDroppedCount,
      summary.semantic.cacheHits,
      summary.semantic.cacheMisses,
      summary.semantic.llmEvaluated,
      summary.semantic.heuristicEvaluated,
      summary.semantic.llmFailures,
      summary.metrics.totalMs,
      summary.metrics.fetchMs,
      summary.metrics.normalizeMs,
      summary.metrics.persistMs,
      nowIso
    )
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
  const semantic = await enrichMarketsWithSemanticCache(env, normalized.markets);
  const curation = curateMarkets(
    normalized.markets,
    semantic.byMarketId,
    env,
    semantic.metrics.promptVersion
  );
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
    normalized.dropped + fetched.droppedByBouncer,
    allItems
  );
  const persistMs = Date.now() - persistStarted;

  const summary: RefreshSummary = {
    runId,
    fetchedAt,
    pagesFetched: fetched.pagesFetched,
    rawCount: fetched.markets.length,
    bouncerDroppedCount: fetched.droppedByBouncer,
    normalizedCount: normalized.markets.length,
    droppedCount: normalized.dropped + fetched.droppedByBouncer,
    curatedCount: curation.curated.length,
    rejectedCount: curation.rejected.length,
    semantic: semantic.metrics,
    metrics: {
      totalMs: Date.now() - started,
      fetchMs,
      normalizeMs,
      persistMs,
    },
  };

  try {
    await persistSemanticRunTelemetry(env.DB, summary);
  } catch (error) {
    // Keep refresh robust when telemetry schema is not yet migrated.
    console.error("Failed to persist semantic refresh telemetry", error);
  }

  return summary;
}
