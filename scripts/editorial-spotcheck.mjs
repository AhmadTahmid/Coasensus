#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const topN = asPositiveInt(process.env.COASENSUS_EDITORIAL_TOP_N, 20, 1, 100);
const sort = (process.env.COASENSUS_EDITORIAL_SORT || "score").trim() || "score";
const includeStaging = process.env.COASENSUS_EDITORIAL_INCLUDE_STAGING !== "0";
const requireStaging = process.env.COASENSUS_EDITORIAL_REQUIRE_STAGING === "1";

const targets = [
  {
    key: "production",
    label: "Production",
    baseUrl: (process.env.COASENSUS_EDITORIAL_PRODUCTION_URL || "https://coasensus.com").replace(/\/+$/, ""),
    required: true,
  },
  ...(includeStaging
    ? [
        {
          key: "staging",
          label: "Staging",
          baseUrl: (process.env.COASENSUS_EDITORIAL_STAGING_URL || "https://staging.coasensus.com").replace(/\/+$/, ""),
          required: requireStaging,
        },
      ]
    : []),
];

function asPositiveInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
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
    throw new Error(`HTTP ${response.status} from ${url}: ${text.slice(0, 500)}`);
  }
  if (!data || typeof data !== "object") {
    throw new Error(`Invalid JSON response from ${url}`);
  }
  return data;
}

function summarizeCategories(items) {
  const totals = new Map();
  for (const item of items) {
    const category = String(item?.score?.category || "other").trim() || "other";
    totals.set(category, (totals.get(category) ?? 0) + 1);
  }
  const categories = [...totals.entries()]
    .map(([category, count]) => ({
      category,
      count,
      shareOfTopN: Number((count / Math.max(1, items.length)).toFixed(4)),
    }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
  return {
    categories,
    dominantCategory: categories[0] ?? null,
  };
}

function sanitizeItem(item, rank) {
  return {
    rank,
    id: item?.id ?? null,
    question: item?.question ?? null,
    category: item?.score?.category ?? null,
    geoTag: item?.geoTag ?? null,
    frontPageScore: item?.frontPageScore ?? null,
    civicScore: item?.score?.civicScore ?? null,
    newsworthinessScore: item?.score?.newsworthinessScore ?? null,
    trendDelta: item?.trendDelta ?? null,
    volume: item?.volume ?? null,
    liquidity: item?.liquidity ?? null,
    endDate: item?.endDate ?? null,
    decisionReason: item?.decisionReason ?? null,
    url: item?.url ?? null,
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# Editorial Spotcheck Snapshot");
  lines.push("");
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Top N: ${report.topN}`);
  lines.push(`- Sort: ${report.sort}`);
  lines.push(`- Overall OK: ${report.overallOk ? "YES" : "NO"}`);
  lines.push(`- Reviewer Log Path: \`docs/EDITORIAL_REVIEW_LOG.md\``);

  for (const target of report.targets) {
    lines.push("");
    lines.push(`## ${target.label}`);
    lines.push(`- Base URL: ${target.baseUrl}`);
    lines.push(`- Required: ${target.required ? "YES" : "NO"}`);
    lines.push(`- Snapshot Status: ${target.ok ? "OK" : "FAILED"}`);
    if (!target.ok) {
      lines.push(`- Error: ${target.error}`);
      continue;
    }
    lines.push(`- Feed Generated At: ${target.feedGeneratedAt ?? "unknown"}`);
    lines.push(`- Total Feed Items: ${target.totalItems}`);
    lines.push(`- Captured Top Items: ${target.capturedCount}`);
    if (target.categorySummary.dominantCategory) {
      lines.push(
        `- Dominant Category: ${target.categorySummary.dominantCategory.category} (${target.categorySummary.dominantCategory.shareOfTopN})`
      );
    }

    lines.push("");
    lines.push("| Rank | Category | Region | Question |");
    lines.push("|---:|---|---|---|");
    for (const item of target.items) {
      const question = String(item.question ?? "")
        .replace(/\|/g, "\\|")
        .replace(/\s+/g, " ")
        .slice(0, 120);
      lines.push(`| ${item.rank} | ${item.category ?? "other"} | ${item.geoTag ?? "World"} | ${question} |`);
    }
  }
  return `${lines.join("\n")}\n`;
}

async function collectTargetSnapshot(target) {
  const feedUrl = `${target.baseUrl}/api/feed?page=1&pageSize=${topN}&sort=${encodeURIComponent(sort)}&cache=0`;
  const payload = await fetchJson(feedUrl);
  const meta = payload?.meta ?? {};
  const itemsRaw = Array.isArray(payload?.items) ? payload.items : [];
  const items = itemsRaw.slice(0, topN).map((item, index) => sanitizeItem(item, index + 1));
  return {
    ok: true,
    key: target.key,
    label: target.label,
    required: target.required,
    baseUrl: target.baseUrl,
    feedUrl,
    feedGeneratedAt: meta.generatedAt ?? null,
    totalItems: Number(meta.totalItems ?? 0),
    capturedCount: items.length,
    categorySummary: summarizeCategories(itemsRaw.slice(0, topN)),
    items,
  };
}

async function main() {
  const snapshots = [];
  for (const target of targets) {
    try {
      const snapshot = await collectTargetSnapshot(target);
      snapshots.push(snapshot);
    } catch (error) {
      snapshots.push({
        ok: false,
        key: target.key,
        label: target.label,
        required: target.required,
        baseUrl: target.baseUrl,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const overallOk = snapshots.every((snapshot) => !snapshot.required || snapshot.ok);
  const report = {
    generatedAt: new Date().toISOString(),
    topN,
    sort,
    reviewerLogPath: "docs/EDITORIAL_REVIEW_LOG.md",
    overallOk,
    targets: snapshots,
  };

  const outputDir = path.resolve("artifacts");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "editorial-spotcheck.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(path.join(outputDir, "editorial-spotcheck.md"), renderMarkdown(report), "utf8");

  if (process.env.GITHUB_STEP_SUMMARY) {
    await writeFile(process.env.GITHUB_STEP_SUMMARY, renderMarkdown(report), "utf8");
  }

  console.log(JSON.stringify(report, null, 2));
  if (!overallOk) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
      },
      null,
      2
    )
  );
  process.exit(1);
});
