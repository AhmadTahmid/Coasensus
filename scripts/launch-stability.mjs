#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

const apiBase = (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/+$/, "");
const repository = process.env.GITHUB_REPOSITORY || deriveRepositoryFromGitRemote();
const branch = process.env.COASENSUS_STABILITY_BRANCH || "main";
const windowHours = asPositiveInt(process.env.COASENSUS_STABILITY_WINDOW_HOURS, 24, 1, 168);
const maxAllowedFailures = asPositiveInt(process.env.COASENSUS_STABILITY_MAX_FAILURES, 0, 0, 1000);
const maxAllowedEmptyHours = asPositiveInt(process.env.COASENSUS_STABILITY_MAX_EMPTY_HOURS, 0, 0, 168);
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

const definitions = [
  {
    key: "production",
    label: "Monitor Production",
    workflow: process.env.COASENSUS_STABILITY_PRODUCTION_WORKFLOW || "monitor-production.yml",
    maxGapMinutes: asPositiveInt(process.env.COASENSUS_STABILITY_PRODUCTION_MAX_GAP_MINUTES, 40, 5, 240),
    minRuns: asPositiveInt(process.env.COASENSUS_STABILITY_PRODUCTION_MIN_RUNS, 80, 1, 1000),
    expectedIntervalMinutes: asPositiveInt(
      process.env.COASENSUS_STABILITY_PRODUCTION_INTERVAL_MINUTES,
      15,
      1,
      240
    ),
  },
  {
    key: "staging",
    label: "Monitor Staging",
    workflow: process.env.COASENSUS_STABILITY_STAGING_WORKFLOW || "monitor-staging.yml",
    maxGapMinutes: asPositiveInt(process.env.COASENSUS_STABILITY_STAGING_MAX_GAP_MINUTES, 70, 5, 240),
    minRuns: asPositiveInt(process.env.COASENSUS_STABILITY_STAGING_MIN_RUNS, 40, 1, 1000),
    expectedIntervalMinutes: asPositiveInt(
      process.env.COASENSUS_STABILITY_STAGING_INTERVAL_MINUTES,
      30,
      1,
      240
    ),
  },
];

function asPositiveInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function toIsoHour(date) {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

function parseRepository(raw) {
  const [owner, repo] = String(raw || "").split("/");
  return {
    owner: owner || "",
    repo: repo || "",
  };
}

function deriveRepositoryFromGitRemote() {
  try {
    const remote = execSync("git config --get remote.origin.url", { encoding: "utf8" }).trim();
    if (!remote) {
      return "";
    }
    const cleaned = remote.replace(/\.git$/, "");
    const sshMatch = cleaned.match(/github\.com[:/](.+?)\/(.+)$/i);
    if (sshMatch) {
      return `${sshMatch[1]}/${sshMatch[2]}`;
    }
    return "";
  } catch {
    return "";
  }
}

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchGitHub(pathname, tokenValue) {
  const response = await fetch(`${apiBase}${pathname}`, {
    headers: {
      Authorization: `Bearer ${tokenValue}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "coasensus-launch-stability-script",
    },
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  }
  return data;
}

function isFailureConclusion(conclusion) {
  return (
    conclusion === "failure" ||
    conclusion === "timed_out" ||
    conclusion === "cancelled" ||
    conclusion === "action_required"
  );
}

async function fetchCompletedRuns({ owner, repo, workflow, sinceIso, untilIso }) {
  const runs = [];
  let page = 1;
  while (page <= 5) {
    const query = new URLSearchParams({
      branch,
      per_page: "100",
      page: String(page),
      exclude_pull_requests: "true",
    });
    const payload = await fetchGitHub(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(workflow)}/runs?${query.toString()}`,
      token
    );
    const batch = Array.isArray(payload?.workflow_runs) ? payload.workflow_runs : [];
    if (!batch.length) {
      break;
    }

    for (const run of batch) {
      const createdAt = String(run?.created_at || "");
      if (!createdAt) continue;
      if (createdAt < sinceIso) {
        return runs.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
      }
      if (createdAt > untilIso) {
        continue;
      }
      if (String(run?.status) !== "completed") {
        continue;
      }
      runs.push({
        id: Number(run?.id ?? 0),
        name: String(run?.name || ""),
        runNumber: Number(run?.run_number ?? 0),
        event: String(run?.event || ""),
        conclusion: String(run?.conclusion || ""),
        createdAt,
        updatedAt: String(run?.updated_at || ""),
        url: String(run?.html_url || ""),
      });
    }
    if (batch.length < 100) {
      break;
    }
    page += 1;
  }
  return runs.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

function summarizeRuns(runs, { nowMs, sinceMs, hours, maxGapMinutes, minRuns }) {
  const successCount = runs.filter((run) => run.conclusion === "success").length;
  const failureRuns = runs.filter((run) => isFailureConclusion(run.conclusion));
  const failureCount = failureRuns.length;
  const totalCount = runs.length;
  const bucketMs = 60 * 60 * 1000;

  const hourly = [];
  for (let index = 0; index < hours; index += 1) {
    const startMs = sinceMs + index * bucketMs;
    hourly.push({
      hourStart: toIsoHour(startMs),
      total: 0,
      success: 0,
      failure: 0,
    });
  }

  for (const run of runs) {
    const runMs = Date.parse(run.createdAt);
    const idx = Math.floor((runMs - sinceMs) / bucketMs);
    if (idx < 0 || idx >= hourly.length) {
      continue;
    }
    const row = hourly[idx];
    row.total += 1;
    if (run.conclusion === "success") {
      row.success += 1;
    } else if (isFailureConclusion(run.conclusion)) {
      row.failure += 1;
    }
  }

  const emptyHours = hourly.filter((row) => row.total === 0).map((row) => row.hourStart);
  const failureHours = hourly.filter((row) => row.failure > 0).map((row) => row.hourStart);

  let maxGapObservedMinutes = 0;
  if (runs.length === 0) {
    maxGapObservedMinutes = Number(((nowMs - sinceMs) / 60000).toFixed(2));
  } else {
    let previousMs = sinceMs;
    for (const run of runs) {
      const runMs = Date.parse(run.createdAt);
      const gapMinutes = (runMs - previousMs) / 60000;
      if (gapMinutes > maxGapObservedMinutes) {
        maxGapObservedMinutes = gapMinutes;
      }
      previousMs = runMs;
    }
    const tailGapMinutes = (nowMs - previousMs) / 60000;
    if (tailGapMinutes > maxGapObservedMinutes) {
      maxGapObservedMinutes = tailGapMinutes;
    }
  }
  maxGapObservedMinutes = Number(maxGapObservedMinutes.toFixed(2));

  const reasons = [];
  if (totalCount < minRuns) {
    reasons.push(`run_count_below_min (${totalCount} < ${minRuns})`);
  }
  if (failureCount > maxAllowedFailures) {
    reasons.push(`failures_exceeded (${failureCount} > ${maxAllowedFailures})`);
  }
  if (emptyHours.length > maxAllowedEmptyHours) {
    reasons.push(`empty_hours_exceeded (${emptyHours.length} > ${maxAllowedEmptyHours})`);
  }
  if (maxGapObservedMinutes > maxGapMinutes) {
    reasons.push(`max_gap_exceeded (${maxGapObservedMinutes} > ${maxGapMinutes} minutes)`);
  }

  return {
    ready: reasons.length === 0,
    reasons,
    totalCount,
    successCount,
    failureCount,
    maxGapObservedMinutes,
    maxGapAllowedMinutes: maxGapMinutes,
    minRunsRequired: minRuns,
    emptyHours,
    failureHours,
    hourly,
    latestRun: runs[runs.length - 1] ?? null,
    sampleFailures: failureRuns.slice(-5),
  };
}

function buildSyntheticSuccessRuns(startExclusiveMs, endInclusiveMs, intervalMinutes) {
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0 || endInclusiveMs <= startExclusiveMs) {
    return [];
  }

  const intervalMs = intervalMinutes * 60 * 1000;
  let cursorMs = Math.ceil(startExclusiveMs / intervalMs) * intervalMs;
  if (cursorMs <= startExclusiveMs) {
    cursorMs += intervalMs;
  }

  const synthetic = [];
  while (cursorMs <= endInclusiveMs) {
    const iso = new Date(cursorMs).toISOString();
    synthetic.push({
      id: -cursorMs,
      name: "Synthetic Scheduled Success",
      runNumber: 0,
      event: "synthetic",
      conclusion: "success",
      createdAt: iso,
      updatedAt: iso,
      url: "about:synthetic",
    });
    cursorMs += intervalMs;
  }
  return synthetic;
}

function estimateEarliestReadyAt({
  historicalRuns,
  nowMs,
  windowHours: currentWindowHours,
  maxGapMinutes,
  minRuns,
  expectedIntervalMinutes,
}) {
  const horizonHours = Math.max(currentWindowHours * 2, 48);
  const horizonMs = horizonHours * 60 * 60 * 1000;
  const stepMinutes = 5;
  const stepMs = stepMinutes * 60 * 1000;

  for (let candidateNowMs = nowMs; candidateNowMs <= nowMs + horizonMs; candidateNowMs += stepMs) {
    const syntheticRuns = buildSyntheticSuccessRuns(nowMs, candidateNowMs, expectedIntervalMinutes);
    const combined = [...historicalRuns, ...syntheticRuns].sort(
      (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
    );
    const candidateSinceMs = candidateNowMs - currentWindowHours * 60 * 60 * 1000;
    const windowedRuns = combined.filter((run) => {
      const runMs = Date.parse(run.createdAt);
      return Number.isFinite(runMs) && runMs >= candidateSinceMs && runMs <= candidateNowMs;
    });
    const summary = summarizeRuns(windowedRuns, {
      nowMs: candidateNowMs,
      sinceMs: candidateSinceMs,
      hours: currentWindowHours,
      maxGapMinutes,
      minRuns,
    });
    if (summary.ready) {
      return {
        at: new Date(candidateNowMs).toISOString(),
        assumptions: `no new monitor failures and successful ${expectedIntervalMinutes}m cadence`,
        stepMinutes,
        horizonHours,
      };
    }
  }

  return {
    at: null,
    assumptions: `no new monitor failures and successful ${expectedIntervalMinutes}m cadence`,
    stepMinutes,
    horizonHours,
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# Launch Stability Status");
  lines.push("");
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Repository: ${report.repository}`);
  lines.push(`- Branch: ${report.branch}`);
  lines.push(`- Window: ${report.windowHours}h`);
  lines.push(`- Overall Ready: ${report.overallReady ? "YES" : "NO"}`);
  lines.push(`- Estimated Overall Ready At: ${report.estimatedOverallReadyAt || "unknown"}`);
  lines.push("");
  lines.push("| Workflow | Ready | Runs | Success | Failures | Max Gap (min) | Empty Hours | Est. Ready At |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---|");
  for (const workflow of report.workflows) {
    lines.push(
      `| ${workflow.label} | ${workflow.ready ? "YES" : "NO"} | ${workflow.totalCount} | ${workflow.successCount} | ${workflow.failureCount} | ${workflow.maxGapObservedMinutes} | ${workflow.emptyHours.length} | ${workflow.estimatedReadyAt || "unknown"} |`
    );
  }

  for (const workflow of report.workflows) {
    lines.push("");
    lines.push(`## ${workflow.label}`);
    lines.push(`- Ready: ${workflow.ready ? "YES" : "NO"}`);
    lines.push(`- Reasons: ${workflow.reasons.length ? workflow.reasons.join(", ") : "none"}`);
    lines.push(`- Estimated Ready At: ${workflow.estimatedReadyAt || "unknown"}`);
    lines.push(`- Estimate Assumptions: ${workflow.estimateAssumptions}`);
    if (workflow.latestRun) {
      lines.push(`- Latest run: ${workflow.latestRun.createdAt} (${workflow.latestRun.conclusion})`);
      lines.push(`- Latest run URL: ${workflow.latestRun.url}`);
    }
  }

  lines.push("");
  lines.push("## Raw Artifact");
  lines.push("- JSON artifact: `artifacts/launch-status.json`");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const { owner, repo } = parseRepository(repository);
  ensure(owner && repo, "Missing GITHUB_REPOSITORY (expected owner/repo)");
  ensure(token.trim().length > 0, "Missing GitHub token (`GITHUB_TOKEN` or `GH_TOKEN`)");

  const nowMs = Date.now();
  const sinceMs = nowMs - windowHours * 60 * 60 * 1000;
  const sinceIso = new Date(sinceMs).toISOString();
  const untilIso = new Date(nowMs).toISOString();

  const workflows = [];
  for (const definition of definitions) {
    const runs = await fetchCompletedRuns({
      owner,
      repo,
      workflow: definition.workflow,
      sinceIso,
      untilIso,
    });
    const summary = summarizeRuns(runs, {
      nowMs,
      sinceMs,
      hours: windowHours,
      maxGapMinutes: definition.maxGapMinutes,
      minRuns: definition.minRuns,
    });
    const estimate = estimateEarliestReadyAt({
      historicalRuns: runs,
      nowMs,
      windowHours,
      maxGapMinutes: definition.maxGapMinutes,
      minRuns: definition.minRuns,
      expectedIntervalMinutes: definition.expectedIntervalMinutes,
    });
    workflows.push({
      key: definition.key,
      label: definition.label,
      workflow: definition.workflow,
      expectedIntervalMinutes: definition.expectedIntervalMinutes,
      estimatedReadyAt: estimate.at,
      estimateAssumptions: estimate.assumptions,
      estimateStepMinutes: estimate.stepMinutes,
      estimateHorizonHours: estimate.horizonHours,
      ...summary,
    });
  }

  const estimatedOverallReadyAt = (() => {
    const timestamps = workflows.map((workflow) => Date.parse(workflow.estimatedReadyAt || ""));
    if (timestamps.some((value) => !Number.isFinite(value))) {
      return null;
    }
    return new Date(Math.max(...timestamps)).toISOString();
  })();

  const report = {
    generatedAt: new Date().toISOString(),
    repository,
    branch,
    windowHours,
    maxAllowedFailures,
    maxAllowedEmptyHours,
    overallReady: workflows.every((workflow) => workflow.ready),
    estimatedOverallReadyAt,
    workflows,
  };

  const outputDir = path.resolve("artifacts");
  await mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "launch-status.json");
  const mdPath = path.join(outputDir, "launch-status.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(mdPath, renderMarkdown(report), "utf8");

  const stepSummaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummaryPath) {
    await writeFile(stepSummaryPath, renderMarkdown(report), "utf8");
  }

  console.log(JSON.stringify(report, null, 2));
  if (!report.overallReady) {
    process.exit(1);
  }
}

main().catch((error) => {
  const output = {
    ok: false,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null,
  };
  console.error(JSON.stringify(output, null, 2));
  process.exit(1);
});
