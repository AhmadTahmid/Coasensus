#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

const repository = String(process.env.GITHUB_REPOSITORY || "").trim();
const githubToken = String(process.env.GITHUB_TOKEN || "").trim();
const runId = String(process.env.GITHUB_RUN_ID || "").trim();
const serverUrl = String(process.env.GITHUB_SERVER_URL || "https://github.com").trim();
const snapshotPath = path.resolve(process.cwd(), process.env.COASENSUS_OPS_SNAPSHOT_PATH || "artifacts/ops-snapshot.json");
const incidentLabel = String(process.env.COASENSUS_OPS_ALERT_LABEL || "ops-alert").trim();
const incidentTitle = String(process.env.COASENSUS_OPS_ALERT_TITLE || "[Ops Snapshot] Active Incident").trim();
const dryRun = process.env.COASENSUS_ALERTS_DRY_RUN === "1";

function compactAlert(alert) {
  const source = alert?.sourceLabel ? `${alert.sourceLabel}: ` : "";
  const code = alert?.code ? `[${alert.code}] ` : "";
  return `${source}${code}${alert?.message || "unknown alert"}`;
}

function isoNow() {
  return new Date().toISOString();
}

function runUrl() {
  if (!repository || !runId) return null;
  return `${serverUrl}/${repository}/actions/runs/${runId}`;
}

function buildFailureBody(report) {
  const lines = [];
  lines.push("# Ops Snapshot Incident");
  lines.push("");
  lines.push(`- Status: FAIL`);
  lines.push(`- Snapshot Generated: ${report.generatedAt || "n/a"}`);
  lines.push(`- Error Alerts: ${report.summary?.errorAlerts ?? "n/a"}`);
  lines.push(`- Warning Alerts: ${report.summary?.warnAlerts ?? "n/a"}`);
  if (runUrl()) {
    lines.push(`- Workflow Run: ${runUrl()}`);
  }
  lines.push("");
  lines.push("## Active Alerts");
  lines.push("");

  const alerts = Array.isArray(report.alerts) ? report.alerts : [];
  if (!alerts.length) {
    lines.push("- none");
  } else {
    for (const alert of alerts.slice(0, 20)) {
      lines.push(`- ${compactAlert(alert)}`);
    }
    if (alerts.length > 20) {
      lines.push(`- ... (${alerts.length - 20} more alerts)`);
    }
  }

  lines.push("");
  lines.push("## Environment Status");
  lines.push("");
  lines.push("| Environment | Status | Feed Items | Stale (min) |");
  lines.push("|---|---|---:|---:|");
  for (const env of Array.isArray(report.environments) ? report.environments : []) {
    const checks = env.checks || {};
    const status = env.ok ? "PASS" : "FAIL";
    lines.push(`| ${env.label || env.key || "n/a"} | ${status} | ${checks.feedTotalItems ?? "n/a"} | ${checks.staleMinutes ?? "n/a"} |`);
  }

  lines.push("");
  lines.push("_This issue is managed by `scripts/ops-alert-routing.mjs` in `.github/workflows/ops-snapshot.yml`._");
  return `${lines.join("\n")}\n`;
}

function buildFailureComment(report) {
  const lines = [];
  lines.push(`Incident update at ${isoNow()}.`);
  if (runUrl()) {
    lines.push(`Run: ${runUrl()}`);
  }
  const alerts = Array.isArray(report.alerts) ? report.alerts : [];
  lines.push(`Alerts: ${alerts.length}`);
  for (const alert of alerts.slice(0, 10)) {
    lines.push(`- ${compactAlert(alert)}`);
  }
  if (alerts.length > 10) {
    lines.push(`- ... (${alerts.length - 10} more)`);
  }
  return `${lines.join("\n")}\n`;
}

function buildRecoveryComment(report) {
  const lines = [];
  lines.push(`Recovery confirmed at ${isoNow()}.`);
  lines.push(`Snapshot status is PASS.`);
  if (runUrl()) {
    lines.push(`Run: ${runUrl()}`);
  }
  lines.push(`Errors: ${report.summary?.errorAlerts ?? 0}, Warnings: ${report.summary?.warnAlerts ?? 0}`);
  lines.push("Closing this incident.");
  return `${lines.join("\n")}\n`;
}

async function fetchGitHub(pathname, { method = "GET", body } = {}) {
  const url = `https://api.github.com${pathname}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(`GitHub API ${response.status} ${response.statusText} for ${pathname}`);
    error.detail = {
      status: response.status,
      statusText: response.statusText,
      body: parsed || text,
    };
    throw error;
  }
  return parsed;
}

async function readSnapshotOrFallback() {
  try {
    const raw = await readFile(snapshotPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid snapshot JSON");
    }
    return parsed;
  } catch (error) {
    return {
      generatedAt: isoNow(),
      ok: false,
      summary: {
        errorAlerts: 1,
        warnAlerts: 0,
      },
      alerts: [
        {
          severity: "error",
          code: "OPS_SNAPSHOT_ARTIFACT_MISSING",
          message: `Unable to read ops snapshot artifact at ${snapshotPath}: ${error.message}`,
        },
      ],
      environments: [],
      workflows: [],
    };
  }
}

async function ensureLabel(owner, repo) {
  if (dryRun) {
    return;
  }
  try {
    await fetchGitHub(`/repos/${owner}/${repo}/labels/${encodeURIComponent(incidentLabel)}`);
  } catch (error) {
    if (error?.detail?.status !== 404) {
      throw error;
    }
    await fetchGitHub(`/repos/${owner}/${repo}/labels`, {
      method: "POST",
      body: {
        name: incidentLabel,
        color: "B60205",
        description: "Automated operations alerts from Ops Snapshot workflow",
      },
    });
  }
}

async function findOpenIncidentIssue(owner, repo) {
  const issues = await fetchGitHub(
    `/repos/${owner}/${repo}/issues?state=open&labels=${encodeURIComponent(incidentLabel)}&per_page=50`
  );
  if (!Array.isArray(issues)) return null;
  return issues.find((issue) => issue?.title === incidentTitle) || null;
}

async function createIssue(owner, repo, body) {
  return fetchGitHub(`/repos/${owner}/${repo}/issues`, {
    method: "POST",
    body: {
      title: incidentTitle,
      labels: [incidentLabel],
      body,
    },
  });
}

async function commentIssue(owner, repo, issueNumber, body) {
  return fetchGitHub(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    method: "POST",
    body: { body },
  });
}

async function closeIssue(owner, repo, issueNumber) {
  return fetchGitHub(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
    method: "PATCH",
    body: { state: "closed" },
  });
}

async function main() {
  if (!repository) {
    throw new Error("Missing GITHUB_REPOSITORY");
  }
  if (!githubToken && !dryRun) {
    throw new Error("Missing GITHUB_TOKEN");
  }

  const [owner, repo] = repository.split("/", 2);
  if (!owner || !repo) {
    throw new Error(`Invalid GITHUB_REPOSITORY: ${repository}`);
  }

  const report = await readSnapshotOrFallback();
  const incidentActive = report.ok !== true;

  if (dryRun) {
    const summary = {
      dryRun: true,
      repository,
      incidentLabel,
      incidentTitle,
      incidentActive,
      alertCount: Array.isArray(report.alerts) ? report.alerts.length : 0,
      runUrl: runUrl(),
    };
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  await ensureLabel(owner, repo);
  const existing = await findOpenIncidentIssue(owner, repo);

  if (incidentActive) {
    const issueBody = buildFailureBody(report);
    const commentBody = buildFailureComment(report);
    if (!existing) {
      const created = await createIssue(owner, repo, issueBody);
      await commentIssue(owner, repo, created.number, commentBody);
      console.log(
        JSON.stringify(
          {
            ok: true,
            action: "created_incident_issue",
            issueNumber: created.number,
            issueUrl: created.html_url,
            alertCount: Array.isArray(report.alerts) ? report.alerts.length : 0,
          },
          null,
          2
        )
      );
      return;
    }

    await commentIssue(owner, repo, existing.number, commentBody);
    console.log(
      JSON.stringify(
        {
          ok: true,
          action: "updated_incident_issue",
          issueNumber: existing.number,
          issueUrl: existing.html_url,
          alertCount: Array.isArray(report.alerts) ? report.alerts.length : 0,
        },
        null,
        2
      )
    );
    return;
  }

  if (existing) {
    const commentBody = buildRecoveryComment(report);
    await commentIssue(owner, repo, existing.number, commentBody);
    await closeIssue(owner, repo, existing.number);
    console.log(
      JSON.stringify(
        {
          ok: true,
          action: "closed_incident_issue",
          issueNumber: existing.number,
          issueUrl: existing.html_url,
        },
        null,
        2
      )
    );
    return;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        action: "no_open_incident_issue",
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message: error?.message || String(error),
        detail: error?.detail ?? null,
      },
      null,
      2
    )
  );
  process.exit(1);
});
