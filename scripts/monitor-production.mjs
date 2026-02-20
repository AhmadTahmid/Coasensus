#!/usr/bin/env node

const baseUrl = (process.env.COASENSUS_BASE_URL || "https://coasensus.com").replace(/\/+$/, "");
const adminToken = process.env.COASENSUS_ADMIN_TOKEN || "";
const maxStaleMinutes = Number(process.env.COASENSUS_MAX_STALE_MINUTES || "90");

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

async function main() {
  const checkedAt = new Date().toISOString();
  let step = "validate-env";
  const healthUrl = `${baseUrl}/api/health`;
  const feedUrl = `${baseUrl}/api/feed?page=1&pageSize=1&sort=score`;
  const metricsUrl = `${baseUrl}/api/admin/semantic-metrics?limit=1`;

  try {
    ensure(adminToken.trim().length > 0, "Missing COASENSUS_ADMIN_TOKEN for telemetry check");
    ensure(Number.isFinite(maxStaleMinutes) && maxStaleMinutes > 0, "Invalid COASENSUS_MAX_STALE_MINUTES");

    step = "check-health";
    const health = await fetchJson(healthUrl);
    ensure(health?.status === "ok", "Health endpoint did not return status=ok", health);

    step = "check-feed";
    const feed = await fetchJson(feedUrl);
    const totalItems = Number(feed?.meta?.totalItems ?? 0);
    ensure(totalItems > 0, "Feed totalItems is zero", feed?.meta ?? feed);
    ensure(Array.isArray(feed?.items) && feed.items.length > 0, "Feed returned no items", feed?.meta ?? feed);

    step = "check-semantic-metrics";
    const telemetry = await fetchJson(metricsUrl, {
      headers: {
        "X-Admin-Token": adminToken,
      },
    });
    const latest = Array.isArray(telemetry?.runs) ? telemetry.runs[0] : null;
    ensure(latest, "No semantic telemetry runs found", telemetry);

    step = "check-staleness";
    const fetchedAtMs = Date.parse(String(latest.fetchedAt || ""));
    ensure(Number.isFinite(fetchedAtMs), "Invalid fetchedAt in telemetry run", latest);

    const staleMinutes = (Date.now() - fetchedAtMs) / 60000;
    ensure(
      staleMinutes <= maxStaleMinutes,
      `Feed refresh is stale: ${staleMinutes.toFixed(1)} min > ${maxStaleMinutes} min`,
      latest
    );

    const report = {
      ok: true,
      checkedAt,
      baseUrl,
      maxStaleMinutes,
      staleMinutes: Number(staleMinutes.toFixed(2)),
      endpoints: {
        healthUrl,
        feedUrl,
        metricsUrl,
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
    };

    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    if (error && typeof error === "object") {
      error.context = {
        checkedAt,
        baseUrl,
        maxStaleMinutes,
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
    message: error?.message || String(error),
    detail: error?.detail ?? null,
    context: error?.context ?? null,
    stack: error?.stack ? String(error.stack).split("\n").slice(0, 6) : null,
  };
  console.error(JSON.stringify(output, null, 2));
  process.exit(1);
});
