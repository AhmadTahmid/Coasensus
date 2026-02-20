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

type FeedSort = "score" | "volume" | "liquidity" | "endDate";

interface Env {
  DB: D1Database;
  COASENSUS_APP_ORIGIN?: string;
  COASENSUS_DEFAULT_PAGE_SIZE?: string;
  COASENSUS_ADMIN_REFRESH_TOKEN?: string;
  COASENSUS_AUTO_REFRESH_ON_EMPTY?: string;
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
  COASENSUS_FRONTPAGE_W1?: string;
  COASENSUS_FRONTPAGE_W2?: string;
  COASENSUS_FRONTPAGE_W3?: string;
  COASENSUS_FRONTPAGE_LAMBDA?: string;
}

interface CuratedFeedRow {
  market_id: string;
  question: string;
  description: string | null;
  url: string;
  end_date: string | null;
  liquidity: number | null;
  volume: number | null;
  open_interest: number | null;
  category: string;
  civic_score: number;
  newsworthiness_score: number;
  front_page_score?: number | null;
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
};

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
  return value === "volume" || value === "liquidity" || value === "endDate" || value === "score" ? value : "score";
}

function asCategory(value: string | null): MarketCategory | null {
  if (!value) {
    return null;
  }
  return CATEGORY_SET.has(value as MarketCategory) ? (value as MarketCategory) : null;
}

function toCategory(value: string): MarketCategory {
  return CATEGORY_SET.has(value as MarketCategory) ? (value as MarketCategory) : "other";
}

function toNumberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function resolveSortSql(sort: FeedSort, hasFrontPageScore: boolean): string {
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

async function handleFeed(url: URL, env: Env, origin: string): Promise<Response> {
  try {
    const page = asPositiveInt(url.searchParams.get("page"), 1, 1, 10_000);
    const pageSize = asPositiveInt(url.searchParams.get("pageSize"), defaultPageSize(env), 1, 100);
    const sort = asFeedSort(url.searchParams.get("sort"));
    const category = asCategory(url.searchParams.get("category"));
    const includeRejected = url.searchParams.get("includeRejected") === "1";

    const whereParts: string[] = [];
    const whereBindings: unknown[] = [];
    if (!includeRejected) {
      whereParts.push("is_curated = 1");
    }
    if (category) {
      whereParts.push("category = ?");
      whereBindings.push(category);
    }

    const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
    const hasFrontPageScore = await curatedFeedHasColumn(env.DB, "front_page_score");
    const orderBySql = resolveSortSql(sort, hasFrontPageScore);
    const frontPageSelectSql = hasFrontPageScore ? "front_page_score," : "";

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
        end_date,
        liquidity,
        volume,
        open_interest,
        category,
        civic_score,
        newsworthiness_score,
        ${frontPageSelectSql}
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
      endDate: row.end_date,
      liquidity: toNumberOrNull(row.liquidity),
      volume: toNumberOrNull(row.volume),
      openInterest: toNumberOrNull(row.open_interest),
      tags: [],
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
    }));

    return json(
      200,
      {
        meta: {
          generatedAt: new Date().toISOString(),
          totalItems,
          totalPages,
          page: safePage,
          pageSize,
          sort,
          category,
          includeRejected,
          sourcePath: "d1:curated_feed",
          scoreFormula: hasFrontPageScore ? "front_page_score_v1" : "legacy_civic_plus_newsworthiness",
          refreshAttempted: refreshSummary !== null || refreshError !== null,
          refreshRunId: refreshSummary?.runId ?? null,
          refreshError,
        },
        items,
      },
      origin
    );
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
      return handleFeed(url, env, origin);
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

    if (request.method !== "GET" && request.method !== "POST") {
      return json(405, { error: "Only GET/POST supported" }, origin);
    }

    return json(
      404,
      {
        error: "Not found",
        routes: [
          "/api/health",
          "/api/feed?page=1&pageSize=20&sort=score",
          "/api/admin/refresh-feed",
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
