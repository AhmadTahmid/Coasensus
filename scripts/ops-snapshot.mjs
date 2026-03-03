#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const generatedAt = new Date().toISOString();
const repository = String(process.env.GITHUB_REPOSITORY || "").trim();
const githubToken = String(process.env.GITHUB_TOKEN || "").trim();
const topN = Number.parseInt(process.env.COASENSUS_DASHBOARD_TOP_N || "20", 10);
const llmSuccessRateMin = Number(process.env.COASENSUS_LLM_SUCCESS_RATE_MIN || "0.70");
const categoryDominanceMaxShare = Number(process.env.COASENSUS_CATEGORY_DOMINANCE_MAX_SHARE || "0.90");

const environments = [
  {
    key: "production",
    label: "Production",
    baseUrl: (process.env.COASENSUS_BASE_URL_PROD || "https://coasensus.com").replace(/\/+$/, ""),
    adminToken: String(process.env.COASENSUS_ADMIN_TOKEN_PROD || "").trim(),
    maxStaleMinutes: Number(process.env.COASENSUS_MAX_STALE_MINUTES_PROD || "90"),
    required: true,
  },
  {
    key: "staging",
    label: "Staging",
    baseUrl: (process.env.COASENSUS_BASE_URL_STAGING || "https://staging.coasensus.com").replace(/\/+$/, ""),
    adminToken: String(process.env.COASENSUS_ADMIN_TOKEN_STAGING || "").trim(),
    maxStaleMinutes: Number(process.env.COASENSUS_MAX_STALE_MINUTES_STAGING || "120"),
    required: true,
  },
];

const workflowTargets = [
  {
    key: "monitor-production",
    workflowFile: "monitor-production.yml",
    label: "Monitor Production",
    required: true,
    maxAgeHours: Number(process.env.COASENSUS_MONITOR_PRODUCTION_MAX_AGE_HOURS || "2"),
  },
  {
    key: "monitor-staging",
    workflowFile: "monitor-staging.yml",
    label: "Monitor Staging",
    required: true,
    maxAgeHours: Number(process.env.COASENSUS_MONITOR_STAGING_MAX_AGE_HOURS || "3"),
  },
  {
    key: "launch-stability",
    workflowFile: "launch-stability.yml",
    label: "Launch Stability",
    required: true,
    maxAgeHours: Number(process.env.COASENSUS_LAUNCH_STABILITY_MAX_AGE_HOURS || "3"),
  },
  {
    key: "editorial-spotcheck",
    workflowFile: "editorial-spotcheck.yml",
    label: "Editorial Spotcheck",
    required: false,
    maxAgeHours: Number(process.env.COASENSUS_EDITORIAL_MAX_AGE_HOURS || "36"),
  },
];

function pushAlert(alerts, severity, code, message, detail = null) {
  alerts.push({ severity, code, message, detail });
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseJsonOrNull(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function hoursSince(iso) {
  const parsed = Date.parse(String(iso || ""));
  if (!Number.isFinite(parsed)) return null;
  return Number(((Date.now() - parsed) / 3600000).toFixed(2));
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  return { response, text };
}

async function fetchJson(url, options = {}) {
  const { response, text } = await fetchText(url, options);
  const data = parseJsonOrNull(text);
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status} ${response.statusText} from ${url}`);
    error.detail = {
      url,
      status: response.status,
      statusText: response.statusText,
      bodyPreview: text.slice(0, 500),
    };
    throw error;
  }
  if (data === null) {
    const error = new Error(`Invalid JSON from ${url}`);
    error.detail = {
      url,
      bodyPreview: text.slice(0, 500),
    };
    throw error;
  }
  return data;
}

function compactAlertSummary(alerts) {
  return alerts.map((alert) => `[${alert.code}] ${alert.message}`);
}

async function evaluateEnvironment(config) {
  const alerts = [];
  const details = {
    key: config.key,
    label: config.label,
    required: config.required,
    baseUrl: config.baseUrl,
    maxStaleMinutes: config.maxStaleMinutes,
    endpoints: {
      health: `${config.baseUrl}/api/health`,
      feed: `${config.baseUrl}/api/feed?page=1&pageSize=5&sort=score`,
      metricsNoToken: `${config.baseUrl}/api/admin/semantic-metrics?limit=1`,
      metricsWithToken: `${config.baseUrl}/api/admin/semantic-metrics?limit=1`,
      diagnostics: `${config.baseUrl}/api/admin/feed-diagnostics?topN=${Math.max(topN, 1)}`,
    },
    checks: {
      healthStatus: null,
      healthState: null,
      feedStatus: null,
      feedTotalItems: null,
      feedItemsLength: null,
      scoreFormula: null,
      adminNoTokenStatus: null,
      adminWithTokenStatus: null,
      staleMinutes: null,
      latestSemanticRunId: null,
      latestSemanticFetchedAt: null,
      latestLlmEnabled: null,
      latestLlmAttempts: null,
      latestLlmFailures: null,
      latestLlmSuccessRate: null,
      latestCacheHits: null,
      latestCacheMisses: null,
      categoryDominant: null,
      categoryDominantShare: null,
      topNEvaluated: null,
    },
    alerts,
    ok: false,
  };

  if (!config.adminToken) {
    pushAlert(alerts, "error", "MISSING_ADMIN_TOKEN", "Missing admin token for environment checks");
    return details;
  }
  if (!Number.isFinite(config.maxStaleMinutes) || config.maxStaleMinutes <= 0) {
    pushAlert(alerts, "error", "INVALID_STALE_THRESHOLD", "Invalid stale threshold");
  }

  try {
    const health = await fetchJson(details.endpoints.health);
    details.checks.healthStatus = 200;
    details.checks.healthState = health.status ?? null;
    if (health.status !== "ok") {
      pushAlert(alerts, "error", "HEALTH_NOT_OK", "Health endpoint returned non-ok status", health);
    }
  } catch (error) {
    details.checks.healthStatus = error?.detail?.status ?? null;
    pushAlert(alerts, "error", "HEALTH_REQUEST_FAILED", error.message, error.detail ?? null);
  }

  try {
    const feed = await fetchJson(details.endpoints.feed);
    details.checks.feedStatus = 200;
    details.checks.feedTotalItems = Number(feed?.meta?.totalItems ?? 0);
    details.checks.feedItemsLength = Array.isArray(feed?.items) ? feed.items.length : 0;
    details.checks.scoreFormula = feed?.meta?.scoreFormula ?? null;
    if ((details.checks.feedTotalItems ?? 0) <= 0 || (details.checks.feedItemsLength ?? 0) <= 0) {
      pushAlert(alerts, "error", "EMPTY_FEED", "Feed endpoint returned no items", feed?.meta ?? feed);
    }
  } catch (error) {
    details.checks.feedStatus = error?.detail?.status ?? null;
    pushAlert(alerts, "error", "FEED_REQUEST_FAILED", error.message, error.detail ?? null);
  }

  try {
    const unauth = await fetchText(details.endpoints.metricsNoToken);
    details.checks.adminNoTokenStatus = unauth.response.status;
    if (unauth.response.status !== 401) {
      pushAlert(
        alerts,
        "error",
        "ADMIN_UNAUTHORIZED_MISMATCH",
        `Expected 401 without token; received ${unauth.response.status}`,
        { bodyPreview: unauth.text.slice(0, 500) }
      );
    }
  } catch (error) {
    pushAlert(alerts, "error", "ADMIN_UNAUTHORIZED_CHECK_FAILED", error.message, error.detail ?? null);
  }

  let latestRun = null;
  try {
    const metrics = await fetchJson(details.endpoints.metricsWithToken, {
      headers: {
        "X-Admin-Token": config.adminToken,
      },
    });
    details.checks.adminWithTokenStatus = 200;
    latestRun = Array.isArray(metrics?.runs) ? metrics.runs[0] ?? null : null;
    if (!latestRun) {
      pushAlert(alerts, "error", "MISSING_SEMANTIC_RUN", "No semantic telemetry run found");
    } else {
      details.checks.latestSemanticRunId = latestRun.runId ?? null;
      details.checks.latestSemanticFetchedAt = latestRun.fetchedAt ?? null;
      details.checks.latestLlmEnabled = Boolean(latestRun.llmEnabled);
      details.checks.latestLlmAttempts = Number(latestRun.llmAttempts ?? 0);
      details.checks.latestLlmFailures = Number(latestRun.llmFailures ?? 0);
      details.checks.latestLlmSuccessRate = toNumber(latestRun.llmSuccessRate);
      details.checks.latestCacheHits = Number(latestRun.cacheHits ?? 0);
      details.checks.latestCacheMisses = Number(latestRun.cacheMisses ?? 0);

      const fetchedAtMs = Date.parse(String(latestRun.fetchedAt || ""));
      if (Number.isFinite(fetchedAtMs)) {
        const staleMinutes = Number(((Date.now() - fetchedAtMs) / 60000).toFixed(2));
        details.checks.staleMinutes = staleMinutes;
        if (Number.isFinite(config.maxStaleMinutes) && staleMinutes > config.maxStaleMinutes) {
          pushAlert(
            alerts,
            "error",
            "STALE_FEED",
            `Telemetry run is stale (${staleMinutes.toFixed(2)}m > ${config.maxStaleMinutes}m)`,
            {
              runId: latestRun.runId ?? null,
              fetchedAt: latestRun.fetchedAt ?? null,
            }
          );
        }
      } else {
        pushAlert(alerts, "error", "INVALID_FETCHED_AT", "Semantic telemetry run has invalid fetchedAt value", latestRun);
      }

      if (latestRun.llmEnabled === true) {
        const attempts = Number(latestRun.llmAttempts ?? 0);
        const successRate = toNumber(latestRun.llmSuccessRate);
        const cacheMisses = Number(latestRun.cacheMisses ?? Number.NaN);
        const requiresLlmPass = Number.isFinite(cacheMisses) ? cacheMisses > 0 : true;
        if (requiresLlmPass && attempts <= 0) {
          pushAlert(alerts, "error", "LLM_ATTEMPTS_ZERO", "LLM is enabled but llmAttempts=0", latestRun);
        } else if (attempts > 0 && successRate !== null && successRate < llmSuccessRateMin) {
          pushAlert(
            alerts,
            "error",
            "LLM_SUCCESS_RATE_LOW",
            `LLM success rate is below threshold (${successRate.toFixed(3)} < ${llmSuccessRateMin.toFixed(3)})`,
            latestRun
          );
        }
      }
    }
  } catch (error) {
    details.checks.adminWithTokenStatus = error?.detail?.status ?? null;
    pushAlert(alerts, "error", "ADMIN_METRICS_REQUEST_FAILED", error.message, error.detail ?? null);
  }

  try {
    const diagnostics = await fetchJson(details.endpoints.diagnostics, {
      headers: {
        "X-Admin-Token": config.adminToken,
      },
    });
    const topPageComposition = diagnostics?.topPageComposition ?? null;
    const dominantCategory = topPageComposition?.dominantCategory ?? null;
    const dominantShare = toNumber(dominantCategory?.shareOfTopN);
    const topNEvaluated = Number(topPageComposition?.topNEvaluated ?? 0);
    details.checks.categoryDominant = dominantCategory?.category ?? null;
    details.checks.categoryDominantShare = dominantShare;
    details.checks.topNEvaluated = topNEvaluated;
    if (dominantShare !== null && dominantShare > categoryDominanceMaxShare) {
      pushAlert(
        alerts,
        "error",
        "CATEGORY_DOMINANCE_HIGH",
        `Top-${topNEvaluated} dominant category share too high (${dominantShare.toFixed(3)} > ${categoryDominanceMaxShare.toFixed(3)})`,
        {
          dominantCategory: details.checks.categoryDominant,
          dominantShare,
          topNEvaluated,
        }
      );
    }
  } catch (error) {
    pushAlert(alerts, "error", "DIAGNOSTICS_REQUEST_FAILED", error.message, error.detail ?? null);
  }

  details.ok = !alerts.some((alert) => alert.severity === "error");
  return details;
}

function workflowApiHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function evaluateWorkflowTarget(target) {
  const alerts = [];
  const details = {
    key: target.key,
    workflowFile: target.workflowFile,
    label: target.label,
    required: target.required,
    maxAgeHours: target.maxAgeHours,
    run: null,
    alerts,
    ok: false,
  };

  if (!repository) {
    pushAlert(alerts, "error", "MISSING_REPOSITORY", "Missing GITHUB_REPOSITORY for workflow checks");
    return details;
  }
  if (!githubToken) {
    pushAlert(alerts, "error", "MISSING_GITHUB_TOKEN", "Missing GITHUB_TOKEN for workflow checks");
    return details;
  }

  const url = `https://api.github.com/repos/${repository}/actions/workflows/${encodeURIComponent(target.workflowFile)}/runs?per_page=1`;

  try {
    const payload = await fetchJson(url, {
      headers: workflowApiHeaders(githubToken),
    });
    const latest = Array.isArray(payload?.workflow_runs) ? payload.workflow_runs[0] ?? null : null;
    if (!latest) {
      pushAlert(alerts, target.required ? "error" : "warn", "MISSING_WORKFLOW_RUN", "No runs found for workflow");
      details.ok = !alerts.some((alert) => alert.severity === "error");
      return details;
    }
    const createdAt = latest.created_at ?? null;
    const ageHours = hoursSince(createdAt);
    details.run = {
      id: latest.id ?? null,
      status: latest.status ?? null,
      conclusion: latest.conclusion ?? null,
      event: latest.event ?? null,
      createdAt,
      updatedAt: latest.updated_at ?? null,
      ageHours,
      htmlUrl: latest.html_url ?? null,
      displayTitle: latest.display_title ?? null,
    };

    if (latest.status !== "completed") {
      pushAlert(
        alerts,
        target.required ? "error" : "warn",
        "WORKFLOW_NOT_COMPLETED",
        `Latest run is still ${latest.status}`
      );
    } else if (latest.conclusion !== "success") {
      pushAlert(
        alerts,
        target.required ? "error" : "warn",
        "WORKFLOW_NOT_SUCCESS",
        `Latest run conclusion=${latest.conclusion || "null"}`
      );
    }

    if (ageHours !== null && Number.isFinite(target.maxAgeHours) && ageHours > target.maxAgeHours) {
      pushAlert(
        alerts,
        target.required ? "error" : "warn",
        "WORKFLOW_STALE",
        `Latest run is stale (${ageHours.toFixed(2)}h > ${target.maxAgeHours.toFixed(2)}h)`
      );
    }
  } catch (error) {
    pushAlert(
      alerts,
      target.required ? "error" : "warn",
      "WORKFLOW_REQUEST_FAILED",
      error.message,
      error.detail ?? null
    );
  }

  details.ok = !alerts.some((alert) => alert.severity === "error");
  return details;
}

function pad(value) {
  return String(value ?? "n/a");
}

function percentage(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  return `${(value * 100).toFixed(1)}%`;
}

function buildMarkdown(report) {
  const statusLabel = report.ok ? "PASS" : "FAIL";
  const lines = [];
  lines.push("# Ops Snapshot");
  lines.push("");
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Repository: ${report.repository || "n/a"}`);
  lines.push(`- Overall: ${statusLabel}`);
  lines.push(`- Error Alerts: ${report.summary.errorAlerts}`);
  lines.push(`- Warning Alerts: ${report.summary.warnAlerts}`);
  lines.push("");
  lines.push("## Environment Checks");
  lines.push("");
  lines.push("| Environment | Status | Health | Feed Items | Stale (min) | LLM Success | Dominant Category | Alerts |");
  lines.push("|---|---|---|---:|---:|---:|---|---|");

  for (const env of report.environments) {
    const status = env.ok ? "PASS" : "FAIL";
    const check = env.checks || {};
    const llmSuccess = toNumber(check.latestLlmSuccessRate);
    const dominant = check.categoryDominant ? `${check.categoryDominant} (${percentage(check.categoryDominantShare)})` : "n/a";
    const alertSummary = compactAlertSummary(env.alerts).join("<br/>") || "none";
    lines.push(
      `| ${env.label} | ${status} | ${pad(check.healthState)} | ${pad(check.feedTotalItems)} | ${pad(check.staleMinutes)} | ${llmSuccess === null ? "n/a" : llmSuccess.toFixed(3)} | ${dominant} | ${alertSummary} |`
    );
  }

  lines.push("");
  lines.push("## Workflow Health");
  lines.push("");
  lines.push("| Workflow | Status | Run | Age (h) | URL | Alerts |");
  lines.push("|---|---|---:|---:|---|---|");

  for (const workflow of report.workflows) {
    const status = workflow.ok ? "PASS" : "FAIL";
    const runId = workflow.run?.id ?? "n/a";
    const ageHours = workflow.run?.ageHours;
    const ageLabel = typeof ageHours === "number" ? ageHours.toFixed(2) : "n/a";
    const url = workflow.run?.htmlUrl || "n/a";
    const alertSummary = compactAlertSummary(workflow.alerts).join("<br/>") || "none";
    lines.push(`| ${workflow.label} | ${status} | ${runId} | ${ageLabel} | ${url} | ${alertSummary} |`);
  }

  lines.push("");
  lines.push("## Alert Details");
  lines.push("");

  if (!report.alerts.length) {
    lines.push("- none");
  } else {
    for (const alert of report.alerts) {
      lines.push(`- [${alert.severity.toUpperCase()}][${alert.code}] ${alert.message}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function flattenAlerts(environmentsResult, workflowsResult) {
  const taggedEnvironmentAlerts = environmentsResult.flatMap((env) =>
    env.alerts.map((alert) => ({
      ...alert,
      sourceType: "environment",
      sourceKey: env.key,
      sourceLabel: env.label,
    }))
  );
  const taggedWorkflowAlerts = workflowsResult.flatMap((workflow) =>
    workflow.alerts.map((alert) => ({
      ...alert,
      sourceType: "workflow",
      sourceKey: workflow.key,
      sourceLabel: workflow.label,
    }))
  );
  return [...taggedEnvironmentAlerts, ...taggedWorkflowAlerts];
}

async function writeArtifacts(report) {
  const artifactsDir = path.resolve(process.cwd(), "artifacts");
  await mkdir(artifactsDir, { recursive: true });
  const jsonPath = path.join(artifactsDir, "ops-snapshot.json");
  const markdownPath = path.join(artifactsDir, "ops-snapshot.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, buildMarkdown(report), "utf8");
}

async function run() {
  const environmentsResult = await Promise.all(environments.map((config) => evaluateEnvironment(config)));
  const workflowsResult = await Promise.all(workflowTargets.map((target) => evaluateWorkflowTarget(target)));
  const alerts = flattenAlerts(environmentsResult, workflowsResult);
  const errorAlerts = alerts.filter((alert) => alert.severity === "error");
  const warnAlerts = alerts.filter((alert) => alert.severity === "warn");
  const report = {
    generatedAt,
    repository,
    thresholds: {
      topN,
      llmSuccessRateMin,
      categoryDominanceMaxShare,
    },
    environments: environmentsResult,
    workflows: workflowsResult,
    alerts,
    summary: {
      environmentChecks: environmentsResult.length,
      workflowChecks: workflowsResult.length,
      passedEnvironments: environmentsResult.filter((entry) => entry.ok).length,
      passedWorkflows: workflowsResult.filter((entry) => entry.ok).length,
      errorAlerts: errorAlerts.length,
      warnAlerts: warnAlerts.length,
    },
    ok: errorAlerts.length === 0,
  };

  await writeArtifacts(report);
  console.log(JSON.stringify(report, null, 2));

  if (!report.ok) {
    process.exit(1);
  }
}

run().catch(async (error) => {
  const fallbackReport = {
    generatedAt: new Date().toISOString(),
    repository,
    ok: false,
    alerts: [
      {
        severity: "error",
        code: "OPS_SNAPSHOT_RUNTIME_FAILURE",
        message: error?.message || String(error),
        detail: error?.detail ?? null,
      },
    ],
    summary: {
      environmentChecks: 0,
      workflowChecks: 0,
      passedEnvironments: 0,
      passedWorkflows: 0,
      errorAlerts: 1,
      warnAlerts: 0,
    },
  };
  try {
    await writeArtifacts(fallbackReport);
  } catch {
    // Ignore artifact write failures in fallback path.
  }
  console.error(JSON.stringify(fallbackReport, null, 2));
  process.exit(1);
});
