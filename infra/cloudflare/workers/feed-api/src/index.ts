import { getFeedCounts, refreshCuratedFeed } from "./refresh";

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

type GeoTag = "US" | "EU" | "Asia" | "Africa" | "MiddleEast" | "World";

type FeedSort = "score" | "volume" | "liquidity" | "endDate" | "trend";

interface Env {
  DB: D1Database;
  COASENSUS_APP_ORIGIN?: string;
  COASENSUS_DEFAULT_PAGE_SIZE?: string;
  COASENSUS_ADMIN_REFRESH_TOKEN?: string;
  COASENSUS_AUTO_REFRESH_ON_EMPTY?: string;
  COASENSUS_FEED_CACHE_ENABLED?: string;
  COASENSUS_FEED_CACHE_TTL_SECONDS?: string;
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
  COASENSUS_LLM_MAX_MARKETS_PER_RUN?: string;
  COASENSUS_LLM_FAILOVER_ENABLED?: string;
  COASENSUS_LLM_FAILOVER_FAILURE_STREAK?: string;
  COASENSUS_LLM_FAILOVER_COOLDOWN_RUNS?: string;
  COASENSUS_FRONTPAGE_W1?: string;
  COASENSUS_FRONTPAGE_W2?: string;
  COASENSUS_FRONTPAGE_W3?: string;
  COASENSUS_FRONTPAGE_LAMBDA?: string;
  COASENSUS_SMART_FIREHOSE_ENABLED?: string;
  COASENSUS_SMART_FIREHOSE_WS_URL?: string;
  COASENSUS_SMART_FIREHOSE_WARMUP_MS?: string;
  COASENSUS_SMART_FIREHOSE_MAX_MESSAGES?: string;
  COASENSUS_SMART_FIREHOSE_MAX_ASSET_IDS?: string;
}

interface CuratedFeedRow {
  market_id: string;
  question: string;
  description: string | null;
  url: string;
  probability?: number | null;
  end_date: string | null;
  liquidity: number | null;
  volume: number | null;
  open_interest: number | null;
  category: string;
  geo_tag?: string | null;
  civic_score: number;
  newsworthiness_score: number;
  front_page_score?: number | null;
  trend_delta?: number | null;
  is_curated: number;
  decision_reason: string;
  reason_codes_json: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface AnalyticsRow {
  id: number;
  ts: string;
  event: string;
  source: string;
  session_id: string | null;
  page_url: string | null;
  details_json: string;
}

interface SemanticRefreshRunRow {
  run_id: string;
  fetched_at: string;
  prompt_version: string;
  llm_enabled: number;
  llm_provider: string;
  llm_model: string;
  pages_fetched: number;
  raw_count: number;
  normalized_count: number;
  curated_count: number;
  rejected_count: number;
  bouncer_dropped_count: number;
  cache_hits: number;
  cache_misses: number;
  llm_evaluated: number;
  heuristic_evaluated: number;
  llm_failures: number;
  total_ms: number;
  fetch_ms: number;
  normalize_ms: number;
  persist_ms: number;
  created_at: string;
}

interface SemanticAggregateRow {
  prompt_version: string;
  llm_provider: string;
  llm_model: string;
  run_count: number;
  llm_evaluated: number;
  llm_failures: number;
  heuristic_evaluated: number;
  cache_hits: number;
  cache_misses: number;
  avg_total_ms: number;
}

interface SemanticFailoverStateRow {
  consecutive_failures: number | null;
  cooldown_runs_remaining: number | null;
  last_triggered_at: string | null;
  last_reason: string | null;
  updated_at: string | null;
}

interface FeedDiagnosticsCountsRow {
  total: number;
  curated: number;
  rejected: number;
}

interface FeedDiagnosticsCategoryRow {
  category: string | null;
  curated: number;
  rejected: number;
}

interface FeedDiagnosticsRegionRow {
  region: string | null;
  curated: number;
  rejected: number;
}

interface FeedDiagnosticsRegionCategoryRow {
  region: string | null;
  category: string | null;
  curated: number;
  rejected: number;
}

interface FeedDiagnosticsDecisionReasonRow {
  decision_reason: string | null;
  count: number;
}

interface FeedDiagnosticsReasonCodesRow {
  reason_codes_json: string | null;
}

interface FeedDiagnosticsTopCategoryRow {
  category: string | null;
  count: number;
}

const CATEGORY_SET = new Set<MarketCategory>([
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
]);

const NON_SCORE_SORT_SQL: Record<Exclude<FeedSort, "score">, string> = {
  volume: "COALESCE(volume, -1) DESC, market_id ASC",
  liquidity: "COALESCE(liquidity, -1) DESC, market_id ASC",
  endDate: "CASE WHEN end_date IS NULL THEN 1 ELSE 0 END ASC, end_date ASC, market_id ASC",
  trend: "COALESCE(trend_delta, 0) DESC, market_id ASC",
};
const SEARCH_QUERY_MAX_CHARS = 120;

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function parseJsonObject(value: string | null): Record<string, unknown> {
  if (!value) {
    return {};
  }
  try {
    return asRecord(JSON.parse(value));
  } catch {
    return {};
  }
}

function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function asInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function asPositiveInt(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = asInt(value, fallback);
  return Math.min(max, Math.max(min, parsed));
}

function asFeedSort(value: string | null): FeedSort {
  return value === "volume" || value === "liquidity" || value === "endDate" || value === "trend" || value === "score"
    ? value
    : "score";
}

function asCategory(value: string | null): MarketCategory | null {
  if (!value) {
    return null;
  }
  return CATEGORY_SET.has(value as MarketCategory) ? (value as MarketCategory) : null;
}

function asGeoTag(value: string | null): GeoTag | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (!normalized) {
    return null;
  }
  if (normalized === "us" || normalized === "usa" || normalized === "unitedstates") {
    return "US";
  }
  if (normalized === "eu" || normalized === "europe") {
    return "EU";
  }
  if (normalized === "asia") {
    return "Asia";
  }
  if (normalized === "africa") {
    return "Africa";
  }
  if (normalized === "middleeast" || normalized === "mena") {
    return "MiddleEast";
  }
  if (normalized === "world" || normalized === "global") {
    return "World";
  }
  return null;
}

function toGeoTag(value: string | null | undefined): GeoTag {
  const parsed = asGeoTag(value ?? null);
  return parsed ?? "World";
}

function asSearchQuery(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return null;
  }
  return normalized.slice(0, SEARCH_QUERY_MAX_CHARS);
}

function escapeLikePattern(value: string): string {
  return value.replace(/([%_\\])/g, "\\$1");
}

function toCategory(value: string): MarketCategory {
  return CATEGORY_SET.has(value as MarketCategory) ? (value as MarketCategory) : "other";
}

function toNumberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toRatioOrNull(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }
  return Number((numerator / denominator).toFixed(4));
}

function parseReasonCodes(value: string | null): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

async function curatedFeedHasColumn(db: D1Database, columnName: string): Promise<boolean> {
  try {
    const rows = await db.prepare("PRAGMA table_info(curated_feed)").all<{ name: string }>();
    return (rows.results ?? []).some((row) => row.name === columnName);
  } catch (error) {
    console.error("Failed to inspect curated_feed schema", asErrorMessage(error));
    return false;
  }
}

function resolveSortSql(sort: FeedSort, hasFrontPageScore: boolean, hasTrendDelta: boolean): string {
  if (sort === "trend" && !hasTrendDelta) {
    sort = "score";
  }
  if (sort === "score") {
    if (hasFrontPageScore) {
      return "COALESCE(front_page_score, (civic_score + newsworthiness_score)) DESC, market_id ASC";
    }
    return "(civic_score + newsworthiness_score) DESC, market_id ASC";
  }
  return NON_SCORE_SORT_SQL[sort];
}

function resolveOrigin(request: Request, env: Env): string {
  const configured = env.COASENSUS_APP_ORIGIN?.trim();
  if (!configured) {
    return "*";
  }
  const requestOrigin = request.headers.get("Origin");
  return requestOrigin === configured ? configured : configured;
}

function withCorsHeaders(origin: string): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
    "Content-Type": "application/json; charset=utf-8",
  });
}

function json(status: number, payload: unknown, origin: string): Response {
  return new Response(`${JSON.stringify(payload, null, 2)}\n`, {
    status,
    headers: withCorsHeaders(origin),
  });
}

function normalizePath(pathname: string): string {
  if (pathname === "/api") {
    return "/";
  }
  if (pathname.startsWith("/api/")) {
    return pathname.slice(4);
  }
  return pathname;
}

function defaultPageSize(env: Env): number {
  return asPositiveInt(env.COASENSUS_DEFAULT_PAGE_SIZE ?? null, 20, 1, 100);
}

function autoRefreshOnEmptyEnabled(env: Env): boolean {
  return env.COASENSUS_AUTO_REFRESH_ON_EMPTY !== "0";
}

function feedCacheEnabled(env: Env): boolean {
  return env.COASENSUS_FEED_CACHE_ENABLED !== "0";
}

function feedCacheTtlSeconds(env: Env): number {
  return asPositiveInt(env.COASENSUS_FEED_CACHE_TTL_SECONDS ?? null, 45, 5, 600);
}

function buildFeedCacheKey(
  requestUrl: URL,
  params: {
    page: number;
    pageSize: number;
    sort: FeedSort;
    category: MarketCategory | null;
    region: GeoTag | null;
    searchQuery: string | null;
    includeRejected: boolean;
  }
): Request {
  const cacheUrl = new URL("/api/feed", requestUrl.origin);
  const cacheParams = new URLSearchParams();
  cacheParams.set("page", String(params.page));
  cacheParams.set("pageSize", String(params.pageSize));
  cacheParams.set("sort", params.sort);
  if (params.category) {
    cacheParams.set("category", params.category);
  }
  if (params.region) {
    cacheParams.set("region", params.region);
  }
  if (params.searchQuery) {
    cacheParams.set("q", params.searchQuery);
  }
  if (params.includeRejected) {
    cacheParams.set("includeRejected", "1");
  }
  cacheUrl.search = cacheParams.toString();
  return new Request(cacheUrl.toString(), { method: "GET" });
}

function withFeedCacheHeaders(response: Response, cacheStatus: "HIT" | "MISS" | "BYPASS", ttlSeconds?: number): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Coasensus-Feed-Cache", cacheStatus);
  if (typeof ttlSeconds === "number" && Number.isFinite(ttlSeconds) && ttlSeconds > 0) {
    headers.set("Cache-Control", `public, max-age=${Math.floor(ttlSeconds)}`);
  }
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

function hasRefreshAccess(request: Request, url: URL, env: Env): boolean {
  const expectedToken = env.COASENSUS_ADMIN_REFRESH_TOKEN?.trim();
  if (!expectedToken) {
    return true;
  }

  const fromQuery = url.searchParams.get("token")?.trim();
  if (fromQuery && fromQuery === expectedToken) {
    return true;
  }

  const fromHeader = request.headers.get("X-Admin-Token")?.trim();
  if (fromHeader && fromHeader === expectedToken) {
    return true;
  }

  const authorization = request.headers.get("Authorization")?.trim();
  if (authorization?.startsWith("Bearer ")) {
    const bearer = authorization.slice(7).trim();
    if (bearer && bearer === expectedToken) {
      return true;
    }
  }

  return false;
}

async function handleFeed(request: Request, url: URL, env: Env, origin: string, ctx: ExecutionContext): Promise<Response> {
  try {
    const page = asPositiveInt(url.searchParams.get("page"), 1, 1, 10_000);
    const pageSize = asPositiveInt(url.searchParams.get("pageSize"), defaultPageSize(env), 1, 100);
    const sort = asFeedSort(url.searchParams.get("sort"));
    const category = asCategory(url.searchParams.get("category"));
    const region = asGeoTag(url.searchParams.get("region") ?? url.searchParams.get("geoTag"));
    const searchQuery = asSearchQuery(url.searchParams.get("q") ?? url.searchParams.get("search"));
    const includeRejected = url.searchParams.get("includeRejected") === "1";
    const cacheBypass = url.searchParams.get("cache") === "0";
    const cacheEnabled = request.method === "GET" && feedCacheEnabled(env) && !cacheBypass;
    const cacheTtlSeconds = feedCacheTtlSeconds(env);
    const cacheKey = buildFeedCacheKey(url, {
      page,
      pageSize,
      sort,
      category,
      region,
      searchQuery,
      includeRejected,
    });

    if (cacheEnabled) {
      try {
        const cached = await caches.default.match(cacheKey);
        if (cached) {
          return withFeedCacheHeaders(cached, "HIT", cacheTtlSeconds);
        }
      } catch (error) {
        console.error("Feed cache lookup failed", asErrorMessage(error));
      }
    }

    const hasFrontPageScore = await curatedFeedHasColumn(env.DB, "front_page_score");
    const hasGeoTag = await curatedFeedHasColumn(env.DB, "geo_tag");
    const hasTrendDelta = await curatedFeedHasColumn(env.DB, "trend_delta");
    const hasProbability = await curatedFeedHasColumn(env.DB, "probability");
    const effectiveSort = sort === "trend" && !hasTrendDelta ? "score" : sort;

    const whereParts: string[] = [];
    const whereBindings: unknown[] = [];
    if (!includeRejected) {
      whereParts.push("is_curated = 1");
    }
    if (category) {
      whereParts.push("category = ?");
      whereBindings.push(category);
    }
    if (region && hasGeoTag) {
      whereParts.push("geo_tag = ?");
      whereBindings.push(region);
    }
    if (searchQuery) {
      const pattern = `%${escapeLikePattern(searchQuery.toLowerCase())}%`;
      whereParts.push(
        "(LOWER(question) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(description, '')) LIKE ? ESCAPE '\\')"
      );
      whereBindings.push(pattern, pattern);
    }

    const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
    const orderBySql = resolveSortSql(effectiveSort, hasFrontPageScore, hasTrendDelta);
    const frontPageSelectSql = hasFrontPageScore ? "front_page_score," : "";
    const geoTagSelectSql = hasGeoTag ? "geo_tag," : "";
    const trendDeltaSelectSql = hasTrendDelta ? "trend_delta," : "";
    const probabilitySelectSql = hasProbability ? "probability," : "";

    let refreshSummary: Awaited<ReturnType<typeof refreshCuratedFeed>> | null = null;
    let refreshError: string | null = null;

    let countRow = await env.DB.prepare(`SELECT COUNT(*) AS total FROM curated_feed ${whereSql}`)
      .bind(...whereBindings)
      .first<{ total: number }>();

    let totalItems = Number(countRow?.total ?? 0);
    if (totalItems === 0 && autoRefreshOnEmptyEnabled(env)) {
      try {
        refreshSummary = await refreshCuratedFeed(env);
        countRow = await env.DB.prepare(`SELECT COUNT(*) AS total FROM curated_feed ${whereSql}`)
          .bind(...whereBindings)
          .first<{ total: number }>();
        totalItems = Number(countRow?.total ?? 0);
      } catch (error) {
        refreshError = asErrorMessage(error);
      }
    }

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * pageSize;

    const feedQuery = `
      SELECT
        market_id,
        question,
        description,
        url,
        ${probabilitySelectSql}
        end_date,
        liquidity,
        volume,
        open_interest,
        category,
        ${geoTagSelectSql}
        civic_score,
        newsworthiness_score,
        ${frontPageSelectSql}
        ${trendDeltaSelectSql}
        is_curated,
        decision_reason,
        reason_codes_json,
        created_at,
        updated_at
      FROM curated_feed
      ${whereSql}
      ORDER BY ${orderBySql}
      LIMIT ?
      OFFSET ?
    `;

    const feedRows = await env.DB.prepare(feedQuery)
      .bind(...whereBindings, pageSize, offset)
      .all<CuratedFeedRow>();

    const items = (feedRows.results ?? []).map((row) => ({
      id: row.market_id,
      question: row.question,
      description: row.description,
      url: row.url,
      probability: toNumberOrNull(row.probability),
      endDate: row.end_date,
      liquidity: toNumberOrNull(row.liquidity),
      volume: toNumberOrNull(row.volume),
      openInterest: toNumberOrNull(row.open_interest),
      tags: [],
      geoTag: toGeoTag(row.geo_tag),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isCurated: Number(row.is_curated) === 1,
      decisionReason: row.decision_reason,
      score: {
        civicScore: Number(row.civic_score ?? 0),
        newsworthinessScore: Number(row.newsworthiness_score ?? 0),
        category: toCategory(row.category),
        reasonCodes: parseReasonCodes(row.reason_codes_json),
      },
      frontPageScore: toNumberOrNull(row.front_page_score),
      trendDelta: toNumberOrNull(row.trend_delta),
    }));

    const response = json(
      200,
      {
        meta: {
          generatedAt: new Date().toISOString(),
          totalItems,
          totalPages,
          page: safePage,
          pageSize,
          sort: effectiveSort,
          requestedSort: sort,
          category,
          region,
          searchQuery,
          includeRejected,
          sourcePath: "d1:curated_feed",
          scoreFormula: hasFrontPageScore ? "front_page_score_v1" : "legacy_civic_plus_newsworthiness",
          regionFilterApplied: Boolean(region && hasGeoTag),
          trendSortAvailable: hasTrendDelta,
          refreshAttempted: refreshSummary !== null || refreshError !== null,
          refreshRunId: refreshSummary?.runId ?? null,
          refreshError,
        },
        items,
      },
      origin
    );
    if (!cacheEnabled) {
      return withFeedCacheHeaders(response, "BYPASS");
    }

    const cacheableResponse = withFeedCacheHeaders(response, "MISS", cacheTtlSeconds);
    ctx.waitUntil(
      caches.default.put(cacheKey, cacheableResponse.clone()).catch((error) => {
        console.error("Feed cache write failed", asErrorMessage(error));
      })
    );
    return cacheableResponse;
  } catch (error) {
    return json(
      503,
      {
        error: "Feed unavailable",
        detail: asErrorMessage(error),
        hint: "Apply D1 migrations and load curated_feed rows first.",
      },
      origin
    );
  }
}

async function handleAdminRefresh(
  request: Request,
  url: URL,
  env: Env,
  origin: string,
  ctx: ExecutionContext
): Promise<Response> {
  if (!hasRefreshAccess(request, url, env)) {
    return json(401, { error: "Unauthorized refresh request" }, origin);
  }

  const runAsync = url.searchParams.get("async") === "1";
  if (runAsync) {
    const startedAt = new Date().toISOString();
    ctx.waitUntil(
      refreshCuratedFeed(env).catch((error) => {
        console.error("Async feed refresh failed:", asErrorMessage(error));
      })
    );
    return json(202, { ok: true, queued: true, startedAt }, origin);
  }

  try {
    const summary = await refreshCuratedFeed(env);
    const counts = await getFeedCounts(env.DB);
    return json(200, { ok: true, summary, counts }, origin);
  } catch (error) {
    return json(500, { error: "Feed refresh failed", detail: asErrorMessage(error) }, origin);
  }
}

async function handleFeedDiagnostics(
  request: Request,
  url: URL,
  env: Env,
  origin: string
): Promise<Response> {
  if (!hasRefreshAccess(request, url, env)) {
    return json(401, { error: "Unauthorized feed diagnostics request" }, origin);
  }

  try {
    const hasGeoTag = await curatedFeedHasColumn(env.DB, "geo_tag");
    const hasFrontPageScore = await curatedFeedHasColumn(env.DB, "front_page_score");
    const topN = asPositiveInt(url.searchParams.get("topN"), 20, 1, 100);
    const topCompositionSortSql = resolveSortSql("score", hasFrontPageScore, false);
    const countsQuery = `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN is_curated = 1 THEN 1 ELSE 0 END) AS curated,
        SUM(CASE WHEN is_curated = 0 THEN 1 ELSE 0 END) AS rejected
      FROM curated_feed
    `;

    const categoryCountsQuery = `
      SELECT
        COALESCE(NULLIF(TRIM(category), ''), 'other') AS category,
        SUM(CASE WHEN is_curated = 1 THEN 1 ELSE 0 END) AS curated,
        SUM(CASE WHEN is_curated = 0 THEN 1 ELSE 0 END) AS rejected
      FROM curated_feed
      GROUP BY COALESCE(NULLIF(TRIM(category), ''), 'other')
      ORDER BY (curated + rejected) DESC, category ASC
    `;

    const regionCountsQuery = `
      SELECT
        COALESCE(NULLIF(TRIM(geo_tag), ''), 'World') AS region,
        SUM(CASE WHEN is_curated = 1 THEN 1 ELSE 0 END) AS curated,
        SUM(CASE WHEN is_curated = 0 THEN 1 ELSE 0 END) AS rejected
      FROM curated_feed
      GROUP BY COALESCE(NULLIF(TRIM(geo_tag), ''), 'World')
      ORDER BY (curated + rejected) DESC, region ASC
    `;

    const regionCategoryCountsQuery = `
      SELECT
        COALESCE(NULLIF(TRIM(geo_tag), ''), 'World') AS region,
        COALESCE(NULLIF(TRIM(category), ''), 'other') AS category,
        SUM(CASE WHEN is_curated = 1 THEN 1 ELSE 0 END) AS curated,
        SUM(CASE WHEN is_curated = 0 THEN 1 ELSE 0 END) AS rejected
      FROM curated_feed
      GROUP BY
        COALESCE(NULLIF(TRIM(geo_tag), ''), 'World'),
        COALESCE(NULLIF(TRIM(category), ''), 'other')
      ORDER BY region ASC, (curated + rejected) DESC, category ASC
    `;

    const topDecisionReasonsQuery = `
      SELECT
        COALESCE(NULLIF(TRIM(decision_reason), ''), 'unknown') AS decision_reason,
        COUNT(*) AS count
      FROM curated_feed
      GROUP BY COALESCE(NULLIF(TRIM(decision_reason), ''), 'unknown')
      ORDER BY count DESC, decision_reason ASC
      LIMIT 10
    `;

    const topPageCategoryCountsQuery = `
      SELECT
        COALESCE(NULLIF(TRIM(category), ''), 'other') AS category,
        COUNT(*) AS count
      FROM (
        SELECT category
        FROM curated_feed
        WHERE is_curated = 1
        ORDER BY ${topCompositionSortSql}
        LIMIT ?
      ) AS ranked
      GROUP BY COALESCE(NULLIF(TRIM(category), ''), 'other')
      ORDER BY count DESC, category ASC
    `;

    const [countsRow, categoryRows, decisionReasonRows, reasonCodesRows, topPageCategoryRows] = await Promise.all([
      env.DB.prepare(countsQuery).first<FeedDiagnosticsCountsRow>(),
      env.DB.prepare(categoryCountsQuery).all<FeedDiagnosticsCategoryRow>(),
      env.DB.prepare(topDecisionReasonsQuery).all<FeedDiagnosticsDecisionReasonRow>(),
      env.DB.prepare("SELECT reason_codes_json FROM curated_feed").all<FeedDiagnosticsReasonCodesRow>(),
      env.DB.prepare(topPageCategoryCountsQuery).bind(topN).all<FeedDiagnosticsTopCategoryRow>(),
    ]);
    const [regionRows, regionCategoryRows] = hasGeoTag
      ? await Promise.all([
          env.DB.prepare(regionCountsQuery).all<FeedDiagnosticsRegionRow>(),
          env.DB.prepare(regionCategoryCountsQuery).all<FeedDiagnosticsRegionCategoryRow>(),
        ])
      : [null, null];

    const counts = {
      total: Number(countsRow?.total ?? 0),
      curated: Number(countsRow?.curated ?? 0),
      rejected: Number(countsRow?.rejected ?? 0),
    };

    const categoryTotals = new Map<MarketCategory, { curated: number; rejected: number }>();
    for (const row of categoryRows.results ?? []) {
      const category = toCategory((row.category ?? "other").trim());
      const curated = Number(row.curated ?? 0);
      const rejected = Number(row.rejected ?? 0);
      const current = categoryTotals.get(category);
      if (current) {
        current.curated += curated;
        current.rejected += rejected;
      } else {
        categoryTotals.set(category, { curated, rejected });
      }
    }

    const categoryCounts = [...categoryTotals.entries()]
      .map(([category, value]) => ({
        category,
        curated: value.curated,
        rejected: value.rejected,
        total: value.curated + value.rejected,
        shareOfFeed: toRatioOrNull(value.curated + value.rejected, counts.total),
        curatedShareWithinCategory: toRatioOrNull(value.curated, value.curated + value.rejected),
      }))
      .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));

    const regionTotals = new Map<GeoTag, { curated: number; rejected: number }>();
    if (hasGeoTag) {
      for (const row of regionRows?.results ?? []) {
        const region = toGeoTag(row.region);
        const curated = Number(row.curated ?? 0);
        const rejected = Number(row.rejected ?? 0);
        const current = regionTotals.get(region);
        if (current) {
          current.curated += curated;
          current.rejected += rejected;
        } else {
          regionTotals.set(region, { curated, rejected });
        }
      }
    } else {
      regionTotals.set("World", { curated: counts.curated, rejected: counts.rejected });
    }

    const regionCounts = [...regionTotals.entries()]
      .map(([region, value]) => ({
        region,
        curated: value.curated,
        rejected: value.rejected,
        total: value.curated + value.rejected,
        shareOfFeed: toRatioOrNull(value.curated + value.rejected, counts.total),
        curatedShareWithinRegion: toRatioOrNull(value.curated, value.curated + value.rejected),
      }))
      .sort((a, b) => b.total - a.total || a.region.localeCompare(b.region));

    const regionTotalByTag = new Map<GeoTag, number>(
      regionCounts.map((row) => [row.region, row.total] as const)
    );

    const regionCategoryTotals = new Map<string, { region: GeoTag; category: MarketCategory; curated: number; rejected: number }>();
    if (hasGeoTag) {
      for (const row of regionCategoryRows?.results ?? []) {
        const region = toGeoTag(row.region);
        const category = toCategory((row.category ?? "other").trim());
        const curated = Number(row.curated ?? 0);
        const rejected = Number(row.rejected ?? 0);
        const key = `${region}::${category}`;
        const current = regionCategoryTotals.get(key);
        if (current) {
          current.curated += curated;
          current.rejected += rejected;
        } else {
          regionCategoryTotals.set(key, { region, category, curated, rejected });
        }
      }
    } else {
      for (const category of categoryCounts) {
        regionCategoryTotals.set(`World::${category.category}`, {
          region: "World",
          category: category.category,
          curated: category.curated,
          rejected: category.rejected,
        });
      }
    }

    const regionCategoryDistribution = [...regionCategoryTotals.values()]
      .map((entry) => {
        const total = entry.curated + entry.rejected;
        return {
          region: entry.region,
          category: entry.category,
          curated: entry.curated,
          rejected: entry.rejected,
          total,
          shareWithinRegion: toRatioOrNull(total, regionTotalByTag.get(entry.region) ?? 0),
          shareOfFeed: toRatioOrNull(total, counts.total),
        };
      })
      .sort((a, b) => a.region.localeCompare(b.region) || b.total - a.total || a.category.localeCompare(b.category));

    const topDecisionReasons = (decisionReasonRows.results ?? []).map((row) => ({
      decisionReason: (row.decision_reason ?? "unknown").trim() || "unknown",
      count: Number(row.count ?? 0),
    }));

    const reasonCodeCounts = new Map<string, number>();
    for (const row of reasonCodesRows.results ?? []) {
      for (const reasonCode of parseReasonCodes(row.reason_codes_json)) {
        const normalizedCode = reasonCode.trim();
        if (!normalizedCode) {
          continue;
        }
        reasonCodeCounts.set(normalizedCode, (reasonCodeCounts.get(normalizedCode) ?? 0) + 1);
      }
    }

    const topReasonCodes = [...reasonCodeCounts.entries()]
      .map(([reasonCode, count]) => ({ reasonCode, count }))
      .sort((a, b) => b.count - a.count || a.reasonCode.localeCompare(b.reasonCode))
      .slice(0, 15);

    const topPageCategoryTotals = new Map<MarketCategory, number>();
    for (const row of topPageCategoryRows.results ?? []) {
      const category = toCategory((row.category ?? "other").trim());
      const count = Number(row.count ?? 0);
      topPageCategoryTotals.set(category, (topPageCategoryTotals.get(category) ?? 0) + count);
    }
    const topNEvaluated = [...topPageCategoryTotals.values()].reduce((sum, value) => sum + value, 0);
    const topPageCompositionCategories = [...topPageCategoryTotals.entries()]
      .map(([category, count]) => ({
        category,
        count,
        shareOfTopN: toRatioOrNull(count, topNEvaluated),
      }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
    const dominantCategory = topPageCompositionCategories[0] ?? null;

    return json(
      200,
      {
        counts,
        categoryCounts,
        regionCounts,
        regionCategoryDistribution,
        taxonomyPanel: {
          hasGeoTag,
          regions: regionCounts,
          categories: categoryCounts,
          regionCategory: regionCategoryDistribution,
        },
        topPageComposition: {
          sort: "score",
          scoreFormula: hasFrontPageScore ? "front_page_score_v1" : "legacy_civic_plus_newsworthiness",
          topNRequested: topN,
          topNEvaluated,
          categories: topPageCompositionCategories,
          dominantCategory,
        },
        topDecisionReasons,
        topReasonCodes,
        generatedAt: new Date().toISOString(),
      },
      origin
    );
  } catch (error) {
    return json(
      503,
      {
        error: "Feed diagnostics unavailable",
        detail: asErrorMessage(error),
      },
      origin
    );
  }
}

async function handleAnalyticsPost(request: Request, env: Env, origin: string): Promise<Response> {
  try {
    const body = asRecord(await request.json());
    const event = typeof body.event === "string" ? body.event.trim() : "";
    if (!event) {
      return json(400, { error: "event is required" }, origin);
    }

    const source = typeof body.source === "string" && body.source.trim() ? body.source.trim() : "web";
    const sessionId = typeof body.sessionId === "string" && body.sessionId.trim() ? body.sessionId.trim() : null;
    const pageUrl = typeof body.pageUrl === "string" && body.pageUrl.trim() ? body.pageUrl.trim() : null;
    const details = asRecord(body.details);
    const ts = new Date().toISOString();

    const row = await env.DB.prepare(
      `
      INSERT INTO analytics_events (ts, event, source, session_id, page_url, details_json)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING id
    `
    )
      .bind(ts, event, source, sessionId, pageUrl, JSON.stringify(details))
      .first<{ id: number }>();

    return json(202, { ok: true, id: row?.id ?? null, ts }, origin);
  } catch (error) {
    return json(400, { error: "Invalid analytics payload", detail: asErrorMessage(error) }, origin);
  }
}

async function handleAnalyticsList(url: URL, env: Env, origin: string): Promise<Response> {
  try {
    const limit = asPositiveInt(url.searchParams.get("limit"), 50, 1, 200);
    const rows = await env.DB.prepare(
      `
      SELECT id, ts, event, source, session_id, page_url, details_json
      FROM analytics_events
      ORDER BY id DESC
      LIMIT ?
    `
    )
      .bind(limit)
      .all<AnalyticsRow>();

    const events = (rows.results ?? []).map((row) => ({
      id: row.id,
      ts: row.ts,
      event: row.event,
      source: row.source,
      sessionId: row.session_id,
      pageUrl: row.page_url,
      details: parseJsonObject(row.details_json),
    }));

    return json(200, { events, count: events.length }, origin);
  } catch (error) {
    return json(500, { error: "Failed to read analytics events", detail: asErrorMessage(error) }, origin);
  }
}

async function handleSemanticMetrics(
  request: Request,
  url: URL,
  env: Env,
  origin: string
): Promise<Response> {
  if (!hasRefreshAccess(request, url, env)) {
    return json(401, { error: "Unauthorized semantic metrics request" }, origin);
  }

  try {
    const limit = asPositiveInt(url.searchParams.get("limit"), 30, 1, 200);

    const runsQuery = `
      SELECT
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
      FROM semantic_refresh_runs
      ORDER BY fetched_at DESC
      LIMIT ?
    `;

    const aggregateQuery = `
      SELECT
        prompt_version,
        llm_provider,
        llm_model,
        COUNT(*) AS run_count,
        SUM(llm_evaluated) AS llm_evaluated,
        SUM(llm_failures) AS llm_failures,
        SUM(heuristic_evaluated) AS heuristic_evaluated,
        SUM(cache_hits) AS cache_hits,
        SUM(cache_misses) AS cache_misses,
        AVG(total_ms) AS avg_total_ms
      FROM semantic_refresh_runs
      GROUP BY prompt_version, llm_provider, llm_model
      ORDER BY MAX(fetched_at) DESC
      LIMIT 20
    `;

    const failoverQuery = `
      SELECT
        consecutive_failures,
        cooldown_runs_remaining,
        last_triggered_at,
        last_reason,
        updated_at
      FROM semantic_failover_state
      WHERE id = 1
      LIMIT 1
    `;

    const [runsRows, aggregateRows, failoverRow] = await Promise.all([
      env.DB.prepare(runsQuery).bind(limit).all<SemanticRefreshRunRow>(),
      env.DB.prepare(aggregateQuery).all<SemanticAggregateRow>(),
      env.DB
        .prepare(failoverQuery)
        .first<SemanticFailoverStateRow>()
        .catch((error) => {
          // Keep telemetry endpoint available even if migration 0007 is not yet applied.
          console.warn("Semantic failover state query unavailable", error);
          return null;
        }),
    ]);

    const runs = (runsRows.results ?? []).map((row) => {
      const llmEvaluated = Number(row.llm_evaluated ?? 0);
      const llmFailures = Number(row.llm_failures ?? 0);
      const llmAttempts = llmEvaluated + llmFailures;
      const llmSuccessRate = llmAttempts > 0 ? Number((llmEvaluated / llmAttempts).toFixed(4)) : null;
      return {
        runId: row.run_id,
        fetchedAt: row.fetched_at,
        promptVersion: row.prompt_version,
        llmEnabled: Number(row.llm_enabled) === 1,
        llmProvider: row.llm_provider,
        llmModel: row.llm_model,
        pagesFetched: Number(row.pages_fetched ?? 0),
        rawCount: Number(row.raw_count ?? 0),
        normalizedCount: Number(row.normalized_count ?? 0),
        curatedCount: Number(row.curated_count ?? 0),
        rejectedCount: Number(row.rejected_count ?? 0),
        bouncerDroppedCount: Number(row.bouncer_dropped_count ?? 0),
        cacheHits: Number(row.cache_hits ?? 0),
        cacheMisses: Number(row.cache_misses ?? 0),
        llmAttempts,
        llmEvaluated,
        heuristicEvaluated: Number(row.heuristic_evaluated ?? 0),
        llmFailures,
        llmSuccessRate,
        totalMs: Number(row.total_ms ?? 0),
        fetchMs: Number(row.fetch_ms ?? 0),
        normalizeMs: Number(row.normalize_ms ?? 0),
        persistMs: Number(row.persist_ms ?? 0),
      };
    });

    const aggregates = (aggregateRows.results ?? []).map((row) => {
      const llmEvaluated = Number(row.llm_evaluated ?? 0);
      const llmFailures = Number(row.llm_failures ?? 0);
      const llmAttempts = llmEvaluated + llmFailures;
      const llmSuccessRate = llmAttempts > 0 ? Number((llmEvaluated / llmAttempts).toFixed(4)) : null;
      return {
        promptVersion: row.prompt_version,
        llmProvider: row.llm_provider,
        llmModel: row.llm_model,
        runCount: Number(row.run_count ?? 0),
        llmAttempts,
        llmEvaluated,
        llmFailures,
        heuristicEvaluated: Number(row.heuristic_evaluated ?? 0),
        cacheHits: Number(row.cache_hits ?? 0),
        cacheMisses: Number(row.cache_misses ?? 0),
        llmSuccessRate,
        avgTotalMs: Number(Number(row.avg_total_ms ?? 0).toFixed(2)),
      };
    });

    const failoverState = (() => {
      if (!failoverRow) {
        return null;
      }

      const consecutive = Number(failoverRow.consecutive_failures ?? 0);
      const cooldown = Number(failoverRow.cooldown_runs_remaining ?? 0);
      return {
        consecutiveFailures: Number.isFinite(consecutive) ? Math.max(0, Math.floor(consecutive)) : 0,
        cooldownRunsRemaining: Number.isFinite(cooldown) ? Math.max(0, Math.floor(cooldown)) : 0,
        active: Number.isFinite(cooldown) ? Math.max(0, Math.floor(cooldown)) > 0 : false,
        lastTriggeredAt: failoverRow.last_triggered_at ?? null,
        lastReason: failoverRow.last_reason ?? null,
        updatedAt: failoverRow.updated_at ?? null,
      };
    })();

    return json(
      200,
      {
        generatedAt: new Date().toISOString(),
        runs,
        aggregates,
        failoverState,
      },
      origin
    );
  } catch (error) {
    return json(
      503,
      {
        error: "Semantic telemetry unavailable",
        detail: asErrorMessage(error),
        hint: "Apply migration 0004_semantic_refresh_runs.sql to D1.",
      },
      origin
    );
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = resolveOrigin(request, env);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: withCorsHeaders(origin) });
    }

    const url = new URL(request.url);
    const pathname = normalizePath(url.pathname);

    if (pathname === "/health" && request.method === "GET") {
      return json(200, { status: "ok", service: "coasensus-feed-api-worker" }, origin);
    }

    if (pathname === "/feed" && request.method === "GET") {
      return handleFeed(request, url, env, origin, ctx);
    }

    if (pathname === "/admin/refresh-feed" && request.method === "POST") {
      return handleAdminRefresh(request, url, env, origin, ctx);
    }

    if (pathname === "/analytics" && request.method === "POST") {
      return handleAnalyticsPost(request, env, origin);
    }

    if (pathname === "/analytics" && request.method === "GET") {
      return handleAnalyticsList(url, env, origin);
    }

    if (pathname === "/admin/semantic-metrics" && request.method === "GET") {
      return handleSemanticMetrics(request, url, env, origin);
    }

    if (pathname === "/admin/feed-diagnostics" && request.method === "GET") {
      return handleFeedDiagnostics(request, url, env, origin);
    }

    if (request.method !== "GET" && request.method !== "POST") {
      return json(405, { error: "Only GET/POST supported" }, origin);
    }

    return json(
      404,
      {
        error: "Not found",
        routes: [
          "/api/health",
          "/api/feed?page=1&pageSize=20&sort=score&region=US",
          "/api/admin/refresh-feed",
          "/api/admin/semantic-metrics",
          "/api/admin/feed-diagnostics",
          "/api/analytics",
        ],
      },
      origin
    );
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        try {
          const summary = await refreshCuratedFeed(env);
          console.log("Scheduled refresh completed", summary);
        } catch (error) {
          console.error("Scheduled refresh failed:", asErrorMessage(error));
        }
      })()
    );
  },
};
