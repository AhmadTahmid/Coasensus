const SETTINGS_KEY = "coasensus_admin_dashboard_settings_v1";

function resolveApiBaseDefault() {
  if (typeof window.COASENSUS_API_BASE === "string" && window.COASENSUS_API_BASE.trim()) {
    return normalizeApiBase(window.COASENSUS_API_BASE.trim());
  }

  const host = window.location.hostname;
  const isLocalhost = host === "localhost" || host === "127.0.0.1";
  if (isLocalhost) {
    return "http://localhost:8787/api";
  }
  if (host.endsWith(".coasensus-web.pages.dev")) {
    if (host.startsWith("staging.")) {
      return "https://coasensus-api-staging.tahmidahmad1970.workers.dev/api";
    }
    return "https://coasensus-api.tahmidahmad1970.workers.dev/api";
  }
  return `${window.location.origin}/api`;
}

function normalizeApiBase(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (!trimmed) {
    return resolveApiBaseDefault();
  }
  if (trimmed.endsWith("/api")) {
    return trimmed;
  }
  return `${trimmed}/api`;
}

function asPositiveInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function fmtNum(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toLocaleString() : "n/a";
}

function fmtPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "n/a";
  return `${(num * 100).toFixed(1)}%`;
}

function fmtDateTime(value) {
  if (!value) return "n/a";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function fetchJson(url, token) {
  const headers = {
    Accept: "application/json",
  };
  if (token) {
    headers["X-Admin-Token"] = token;
  }

  const response = await fetch(url, { headers });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail = data && typeof data === "object" && "error" in data ? String(data.error) : text.slice(0, 200);
    throw new Error(`${response.status} ${response.statusText}: ${detail}`);
  }
  if (!data || typeof data !== "object") {
    throw new Error("Invalid JSON response");
  }
  return data;
}

function renderTable(container, columns, rows, emptyMessage) {
  if (!Array.isArray(rows) || rows.length === 0) {
    container.innerHTML = `<p class="table-empty">${escapeHtml(emptyMessage)}</p>`;
    return;
  }

  const head = columns
    .map((column) => `<th>${escapeHtml(column.label)}</th>`)
    .join("");
  const body = rows
    .map((row) => {
      const cells = columns
        .map((column) => {
          const raw = typeof column.render === "function" ? column.render(row) : row[column.key];
          return `<td>${escapeHtml(raw ?? "n/a")}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  container.innerHTML = `
    <div class="table-wrap">
      <table class="diag-table">
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

const el = {
  apiBase: document.getElementById("apiBase"),
  adminToken: document.getElementById("adminToken"),
  semanticLimit: document.getElementById("semanticLimit"),
  topN: document.getElementById("topN"),
  refresh: document.getElementById("refresh"),
  status: document.getElementById("status"),
  serviceHealth: document.getElementById("serviceHealth"),
  serviceMeta: document.getElementById("serviceMeta"),
  feedTotal: document.getElementById("feedTotal"),
  feedMeta: document.getElementById("feedMeta"),
  latestRunAt: document.getElementById("latestRunAt"),
  latestRunMeta: document.getElementById("latestRunMeta"),
  llmSuccess: document.getElementById("llmSuccess"),
  llmMeta: document.getElementById("llmMeta"),
  compositionStatus: document.getElementById("compositionStatus"),
  compositionTable: document.getElementById("compositionTable"),
  semanticRunsTable: document.getElementById("semanticRunsTable"),
  semanticAggTable: document.getElementById("semanticAggTable"),
  categoryTable: document.getElementById("categoryTable"),
  regionTable: document.getElementById("regionTable"),
  decisionTable: document.getElementById("decisionTable"),
  reasonCodeTable: document.getElementById("reasonCodeTable"),
};

function readSettings() {
  const defaults = {
    apiBase: resolveApiBaseDefault(),
    adminToken: "",
    semanticLimit: 20,
    topN: 20,
  };

  try {
    const raw = window.sessionStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaults;

    return {
      apiBase: normalizeApiBase(parsed.apiBase || defaults.apiBase),
      adminToken: String(parsed.adminToken || ""),
      semanticLimit: asPositiveInt(parsed.semanticLimit, 20, 1, 200),
      topN: asPositiveInt(parsed.topN, 20, 1, 100),
    };
  } catch {
    return defaults;
  }
}

function writeSettings(settings) {
  try {
    window.sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage failures.
  }
}

let state = readSettings();

function syncInputs() {
  el.apiBase.value = state.apiBase;
  el.adminToken.value = state.adminToken;
  el.semanticLimit.value = String(state.semanticLimit);
  el.topN.value = String(state.topN);
}

function syncStateFromInputs() {
  state = {
    apiBase: normalizeApiBase(el.apiBase.value),
    adminToken: String(el.adminToken.value || "").trim(),
    semanticLimit: asPositiveInt(el.semanticLimit.value, 20, 1, 200),
    topN: asPositiveInt(el.topN.value, 20, 1, 100),
  };
  writeSettings(state);
  syncInputs();
}

function setStatus(message, type = "neutral") {
  el.status.textContent = message;
  el.status.className = `status dashboard-status status-${type}`;
}

function renderComposition(diag) {
  const composition = diag?.topPageComposition ?? null;
  if (!composition || !Array.isArray(composition.categories)) {
    el.compositionStatus.textContent = "Top-N composition not available.";
    el.compositionTable.innerHTML = "";
    return;
  }

  const dominant = composition.dominantCategory;
  const dominantLabel = dominant
    ? `${dominant.category} (${fmtPercent(dominant.shareOfTopN)} of top ${composition.topNEvaluated || 0})`
    : "n/a";
  el.compositionStatus.textContent = `Dominant category: ${dominantLabel}`;

  renderTable(
    el.compositionTable,
    [
      { key: "category", label: "Category" },
      { key: "count", label: "Count" },
      { key: "shareOfTopN", label: "Share", render: (row) => fmtPercent(row.shareOfTopN) },
    ],
    composition.categories,
    "No top-N composition rows."
  );
}

function renderSemanticRuns(semantic) {
  const runs = Array.isArray(semantic?.runs) ? semantic.runs : [];
  renderTable(
    el.semanticRunsTable,
    [
      { key: "runId", label: "Run ID" },
      { key: "fetchedAt", label: "Fetched At", render: (row) => fmtDateTime(row.fetchedAt) },
      { key: "llmProvider", label: "Provider" },
      { key: "llmModel", label: "Model" },
      { key: "llmAttempts", label: "Attempts" },
      { key: "llmFailures", label: "Failures" },
      { key: "llmSuccessRate", label: "Success", render: (row) => fmtPercent(row.llmSuccessRate) },
      { key: "curatedCount", label: "Curated" },
      { key: "rejectedCount", label: "Rejected" },
      { key: "totalMs", label: "Total ms" },
    ],
    runs,
    "No semantic runs found."
  );
}

function renderSemanticAgg(semantic) {
  const rows = Array.isArray(semantic?.aggregates) ? semantic.aggregates : [];
  renderTable(
    el.semanticAggTable,
    [
      { key: "promptVersion", label: "Prompt Version" },
      { key: "llmProvider", label: "Provider" },
      { key: "llmModel", label: "Model" },
      { key: "runCount", label: "Runs" },
      { key: "llmAttempts", label: "Attempts" },
      { key: "llmFailures", label: "Failures" },
      { key: "llmSuccessRate", label: "Success", render: (row) => fmtPercent(row.llmSuccessRate) },
      { key: "cacheHits", label: "Cache Hits" },
      { key: "cacheMisses", label: "Cache Misses" },
      { key: "avgTotalMs", label: "Avg ms" },
    ],
    rows,
    "No semantic aggregates found."
  );
}

function renderDiagnosticsTables(diag) {
  renderTable(
    el.categoryTable,
    [
      { key: "category", label: "Category" },
      { key: "total", label: "Total" },
      { key: "curated", label: "Curated" },
      { key: "rejected", label: "Rejected" },
      { key: "shareOfFeed", label: "Feed Share", render: (row) => fmtPercent(row.shareOfFeed) },
      {
        key: "curatedShareWithinCategory",
        label: "Curated Share",
        render: (row) => fmtPercent(row.curatedShareWithinCategory),
      },
    ],
    Array.isArray(diag?.categoryCounts) ? diag.categoryCounts : [],
    "No category distribution rows."
  );

  renderTable(
    el.regionTable,
    [
      { key: "region", label: "Region" },
      { key: "total", label: "Total" },
      { key: "curated", label: "Curated" },
      { key: "rejected", label: "Rejected" },
      { key: "shareOfFeed", label: "Feed Share", render: (row) => fmtPercent(row.shareOfFeed) },
      {
        key: "curatedShareWithinRegion",
        label: "Curated Share",
        render: (row) => fmtPercent(row.curatedShareWithinRegion),
      },
    ],
    Array.isArray(diag?.regionCounts) ? diag.regionCounts : [],
    "No region distribution rows."
  );

  renderTable(
    el.decisionTable,
    [
      { key: "decisionReason", label: "Decision Reason" },
      { key: "count", label: "Count" },
    ],
    Array.isArray(diag?.topDecisionReasons) ? diag.topDecisionReasons : [],
    "No decision reason rows."
  );

  renderTable(
    el.reasonCodeTable,
    [
      { key: "reasonCode", label: "Reason Code" },
      { key: "count", label: "Count" },
    ],
    Array.isArray(diag?.topReasonCodes) ? diag.topReasonCodes : [],
    "No reason code rows."
  );
}

function renderSummary(health, feed, semantic, diag) {
  el.serviceHealth.textContent = health?.status || "n/a";
  el.serviceMeta.textContent = `Service: ${health?.service || "unknown"}`;

  el.feedTotal.textContent = fmtNum(feed?.meta?.totalItems);
  const feedGeneratedAt = feed?.meta?.generatedAt || null;
  el.feedMeta.textContent = `Generated: ${fmtDateTime(feedGeneratedAt)}`;

  const latestRun = Array.isArray(semantic?.runs) ? semantic.runs[0] : null;
  el.latestRunAt.textContent = latestRun?.fetchedAt ? fmtDateTime(latestRun.fetchedAt) : "n/a";
  el.latestRunMeta.textContent = latestRun
    ? `Run ${latestRun.runId || "unknown"} | ${latestRun.llmProvider || "n/a"}:${latestRun.llmModel || "n/a"}`
    : "No semantic run data.";

  el.llmSuccess.textContent = latestRun ? fmtPercent(latestRun.llmSuccessRate) : "n/a";
  el.llmMeta.textContent = latestRun
    ? `Attempts ${fmtNum(latestRun.llmAttempts)} | Failures ${fmtNum(latestRun.llmFailures)}`
    : "No attempts recorded.";

  renderComposition(diag);
  renderSemanticRuns(semantic);
  renderSemanticAgg(semantic);
  renderDiagnosticsTables(diag);
}

async function loadDashboard() {
  syncStateFromInputs();
  el.refresh.disabled = true;
  setStatus("Loading diagnostics...", "neutral");

  const healthUrl = `${state.apiBase}/health`;
  const feedUrl = `${state.apiBase}/feed?page=1&pageSize=1&sort=score&cache=0`;
  const semanticUrl = `${state.apiBase}/admin/semantic-metrics?limit=${state.semanticLimit}`;
  const diagnosticsUrl = `${state.apiBase}/admin/feed-diagnostics?topN=${state.topN}`;

  const [healthResult, feedResult, semanticResult, diagResult] = await Promise.allSettled([
    fetchJson(healthUrl, ""),
    fetchJson(feedUrl, ""),
    fetchJson(semanticUrl, state.adminToken),
    fetchJson(diagnosticsUrl, state.adminToken),
  ]);

  const errors = [];
  const health = healthResult.status === "fulfilled" ? healthResult.value : null;
  const feed = feedResult.status === "fulfilled" ? feedResult.value : null;
  const semantic = semanticResult.status === "fulfilled" ? semanticResult.value : null;
  const diag = diagResult.status === "fulfilled" ? diagResult.value : null;

  if (healthResult.status === "rejected") {
    errors.push(`health: ${healthResult.reason instanceof Error ? healthResult.reason.message : String(healthResult.reason)}`);
  }
  if (feedResult.status === "rejected") {
    errors.push(`feed: ${feedResult.reason instanceof Error ? feedResult.reason.message : String(feedResult.reason)}`);
  }
  if (semanticResult.status === "rejected") {
    errors.push(
      `semantic-metrics: ${semanticResult.reason instanceof Error ? semanticResult.reason.message : String(semanticResult.reason)}`
    );
  }
  if (diagResult.status === "rejected") {
    errors.push(
      `feed-diagnostics: ${diagResult.reason instanceof Error ? diagResult.reason.message : String(diagResult.reason)}`
    );
  }

  if (health || feed || semantic || diag) {
    renderSummary(health, feed, semantic, diag);
  }

  if (errors.length === 0) {
    setStatus(`Diagnostics updated at ${new Date().toLocaleTimeString()}.`, "ok");
  } else if (errors.length < 4) {
    setStatus(`Partial diagnostics loaded. ${errors.join(" | ")}`, "warn");
  } else {
    setStatus(`Diagnostics failed. ${errors.join(" | ")}`, "error");
  }
  el.refresh.disabled = false;
}

el.refresh.addEventListener("click", () => {
  void loadDashboard();
});

el.adminToken.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    void loadDashboard();
  }
});

el.apiBase.addEventListener("change", () => {
  syncStateFromInputs();
});
el.semanticLimit.addEventListener("change", () => {
  syncStateFromInputs();
});
el.topN.addEventListener("change", () => {
  syncStateFromInputs();
});

syncInputs();
void loadDashboard();
