#!/usr/bin/env node

const baseUrl = (process.env.COASENSUS_BASE_URL || "https://coasensus.com").replace(/\/+$/, "");
const adminToken = process.env.COASENSUS_ADMIN_TOKEN || "";
const maxStaleMinutes = Number(process.env.COASENSUS_MAX_STALE_MINUTES || "90");
const semanticFailureStreak = Number.parseInt(process.env.COASENSUS_SEMANTIC_FAILURE_STREAK || "3", 10);
const categoryDominanceTopN = Number.parseInt(process.env.COASENSUS_CATEGORY_DOMINANCE_TOP_N || "20", 10);
const categoryDominanceMaxShare = Number(process.env.COASENSUS_CATEGORY_DOMINANCE_MAX_SHARE || "0.65");

function toError(message, detail, context) {
  const error = new Error(message);
  if (detail !== undefined) {
    error.detail = detail;
  }
  if (context !== undefined) {
    error.context = context;
  }
  return error;
}

async function fetchText(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  return { response, text };
}

function parseJsonOrNull(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fetchJson(url, options) {
  const { response, text } = await fetchText(url, options);
  const data = parseJsonOrNull(text);
  if (!response.ok) {
    throw toError(
      `HTTP ${response.status} from ${url}`,
      { bodyPreview: text.slice(0, 500) },
      {
        url,
        status: response.status,
        statusText: response.statusText,
      }
    );
  }
  if (data === null) {
    throw toError(
      `Invalid JSON from ${url}`,
      { bodyPreview: text.slice(0, 500) },
      { url }
    );
  }
  return data;
}

function ensure(condition, message, detail) {
  if (!condition) {
    throw toError(message, detail);
  }
}

function alertMessage(code, message) {
  return `[${code}] ${message}`;
}

function semanticRunSummary(run) {
  return {
    runId: run?.runId ?? null,
    fetchedAt: run?.fetchedAt ?? null,
    llmEnabled: Boolean(run?.llmEnabled),
    llmAttempts: Number(run?.llmAttempts ?? 0),
    llmFailures: Number(run?.llmFailures ?? 0),
    llmSuccessRate: run?.llmSuccessRate ?? null,
  };
}

function categoryCompositionSummary(entry) {
  return {
    category: entry?.category ?? null,
    count: Number(entry?.count ?? 0),
    shareOfTopN: entry?.shareOfTopN ?? null,
  };
}

async function main() {
  const checkedAt = new Date().toISOString();
  let step = "validate-env";
  const healthUrl = `${baseUrl}/api/health`;
  const feedUrl = `${baseUrl}/api/feed?page=1&pageSize=1&sort=score`;
  const metricsLimit = Math.max(semanticFailureStreak, 1);
  const metricsUrl = `${baseUrl}/api/admin/semantic-metrics?limit=${metricsLimit}`;
  const diagnosticsUrl = `${baseUrl}/api/admin/feed-diagnostics?topN=${Math.max(categoryDominanceTopN, 1)}`;

  try {
    ensure(adminToken.trim().length > 0, "Missing COASENSUS_ADMIN_TOKEN for telemetry check");
    ensure(Number.isFinite(maxStaleMinutes) && maxStaleMinutes > 0, "Invalid COASENSUS_MAX_STALE_MINUTES");
    ensure(Number.isInteger(semanticFailureStreak) && semanticFailureStreak > 0, "Invalid COASENSUS_SEMANTIC_FAILURE_STREAK");
    ensure(Number.isInteger(categoryDominanceTopN) && categoryDominanceTopN > 0, "Invalid COASENSUS_CATEGORY_DOMINANCE_TOP_N");
    ensure(
      Number.isFinite(categoryDominanceMaxShare) && categoryDominanceMaxShare > 0 && categoryDominanceMaxShare <= 1,
      "Invalid COASENSUS_CATEGORY_DOMINANCE_MAX_SHARE"
    );

    step = "check-health";
    const health = await fetchJson(healthUrl);
    ensure(health?.status === "ok", "Health endpoint did not return status=ok", health);

    step = "check-feed";
    const feed = await fetchJson(feedUrl);
    const totalItems = Number(feed?.meta?.totalItems ?? 0);
    ensure(
      totalItems > 0,
      alertMessage("ALERT_EMPTY_FEED", "Feed totalItems is zero"),
      feed?.meta ?? feed
    );
    ensure(
      Array.isArray(feed?.items) && feed.items.length > 0,
      alertMessage("ALERT_EMPTY_FEED", "Feed returned no items"),
      feed?.meta ?? feed
    );

    step = "check-semantic-metrics";
    const telemetry = await fetchJson(metricsUrl, {
      headers: {
        "X-Admin-Token": adminToken,
      },
    });
    const runs = Array.isArray(telemetry?.runs) ? telemetry.runs : [];
    const latest = runs[0] ?? null;
    ensure(latest, "No semantic telemetry runs found", telemetry);

    step = "check-staleness";
    const fetchedAtMs = Date.parse(String(latest.fetchedAt || ""));
    ensure(Number.isFinite(fetchedAtMs), "Invalid fetchedAt in telemetry run", latest);

    const staleMinutes = (Date.now() - fetchedAtMs) / 60000;
    ensure(
      staleMinutes <= maxStaleMinutes,
      alertMessage(
        "ALERT_STALE_FEED",
        `Feed refresh is stale: ${staleMinutes.toFixed(1)} min > ${maxStaleMinutes} min`
      ),
      latest
    );

    step = "check-semantic-failure-streak";
    const semanticWindow = runs.slice(0, semanticFailureStreak);
    const semanticWindowSummaries = semanticWindow.map(semanticRunSummary);
    const semanticWindowReady =
      semanticWindow.length === semanticFailureStreak &&
      semanticWindow.every((run) => run?.llmEnabled === true && Number(run?.llmAttempts ?? 0) > 0);
    const semanticFailureStreakTriggered =
      semanticWindowReady && semanticWindow.every((run) => Number(run?.llmFailures ?? 0) > 0);

    ensure(
      !semanticFailureStreakTriggered,
      alertMessage(
        "ALERT_SEMANTIC_FAILURE_STREAK",
        `llmFailures > 0 for ${semanticFailureStreak} consecutive runs`
      ),
      {
        semanticFailureStreak,
        semanticWindow: semanticWindowSummaries,
      }
    );

    step = "check-feed-diagnostics";
    const diagnostics = await fetchJson(diagnosticsUrl, {
      headers: {
        "X-Admin-Token": adminToken,
      },
    });
    const topPageComposition = diagnostics?.topPageComposition ?? null;
    const topCompositionCategories = Array.isArray(topPageComposition?.categories)
      ? topPageComposition.categories.map(categoryCompositionSummary)
      : [];
    const dominantCategory =
      topPageComposition?.dominantCategory && typeof topPageComposition.dominantCategory === "object"
        ? categoryCompositionSummary(topPageComposition.dominantCategory)
        : null;
    const topNEvaluated = Number(topPageComposition?.topNEvaluated ?? 0);
    const dominantShare = Number(dominantCategory?.shareOfTopN ?? Number.NaN);
    const categoryDominanceTriggered =
      Number.isFinite(dominantShare) && topNEvaluated > 0 && dominantShare > categoryDominanceMaxShare;
    ensure(
      !categoryDominanceTriggered,
      alertMessage(
        "ALERT_CATEGORY_DOMINANCE",
        `Top-${topNEvaluated} category concentration exceeded threshold (${dominantShare.toFixed(4)} > ${categoryDominanceMaxShare.toFixed(4)})`
      ),
      {
        threshold: categoryDominanceMaxShare,
        topNRequested: categoryDominanceTopN,
        topNEvaluated,
        dominantCategory,
        categories: topCompositionCategories,
      }
    );

    const report = {
      ok: true,
      checkedAt,
      baseUrl,
      maxStaleMinutes,
      semanticFailureStreak,
      categoryDominanceTopN,
      categoryDominanceMaxShare,
      staleMinutes: Number(staleMinutes.toFixed(2)),
      endpoints: {
        healthUrl,
        feedUrl,
        metricsUrl,
        diagnosticsUrl,
      },
      healthStatus: health.status,
      totalItems,
      latestRun: {
        runId: latest.runId,
        fetchedAt: latest.fetchedAt,
        llmEnabled: latest.llmEnabled,
        llmProvider: latest.llmProvider,
        llmModel: latest.llmModel,
        llmAttempts: latest.llmAttempts,
        llmEvaluated: latest.llmEvaluated,
        llmFailures: latest.llmFailures,
        llmSuccessRate: latest.llmSuccessRate,
        totalMs: latest.totalMs,
      },
      alerts: {
        staleFeed: {
          thresholdMinutes: maxStaleMinutes,
          triggered: false,
        },
        semanticFailureStreak: {
          thresholdRuns: semanticFailureStreak,
          windowSize: semanticWindow.length,
          windowReady: semanticWindowReady,
          triggered: semanticFailureStreakTriggered,
          window: semanticWindowSummaries,
        },
        categoryDominance: {
          thresholdShare: Number(categoryDominanceMaxShare.toFixed(4)),
          topNRequested: categoryDominanceTopN,
          topNEvaluated,
          triggered: categoryDominanceTriggered,
          dominantCategory,
          categories: topCompositionCategories,
        },
      },
    };

    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    if (error && typeof error === "object") {
      error.context = {
        checkedAt,
        baseUrl,
        maxStaleMinutes,
        semanticFailureStreak,
        categoryDominanceTopN,
        categoryDominanceMaxShare,
        step,
        ...(error.context || {}),
      };
    }
    throw error;
  }
}

main().catch((error) => {
  const output = {
    ok: false,
    checkedAt: new Date().toISOString(),
    baseUrl,
    maxStaleMinutes,
    semanticFailureStreak,
    categoryDominanceTopN,
    categoryDominanceMaxShare,
    message: error?.message || String(error),
    detail: error?.detail ?? null,
    context: error?.context ?? null,
    stack: error?.stack ? String(error.stack).split("\n").slice(0, 6) : null,
  };
  console.error(JSON.stringify(output, null, 2));
  process.exit(1);
});
