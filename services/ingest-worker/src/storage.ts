import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Market } from "@coasensus/shared-types";
import type { IngestSnapshot } from "./index.js";
import type { RawPolymarketMarket } from "./normalize.js";

const DEFAULT_OUTPUT_DIR = path.resolve(fileURLToPath(new URL("../../../infra/db/local", import.meta.url)));

export interface IngestPersistenceInput {
  snapshot: IngestSnapshot;
  rawMarkets: RawPolymarketMarket[];
  normalizedMarkets: Market[];
}

export interface PersistIngestionOptions {
  outputDir?: string;
}

export interface PersistedIngestionResult {
  runId: string;
  outputDir: string;
  snapshotPath: string;
  rawPath: string;
  normalizedPath: string;
  latestSnapshotPath: string;
  latestRawPath: string;
  latestNormalizedPath: string;
}

function safeRunId(isoDate: string): string {
  return isoDate.replace(/[:.]/g, "-");
}

async function writeJson(filePath: string, payload: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export async function persistIngestionRun(
  input: IngestPersistenceInput,
  options: PersistIngestionOptions = {}
): Promise<PersistedIngestionResult> {
  const outputDir = path.resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR);
  const runId = safeRunId(input.snapshot.fetchedAt);

  const snapshotsDir = path.join(outputDir, "snapshots");
  const rawDir = path.join(outputDir, "raw");
  const normalizedDir = path.join(outputDir, "normalized");
  const latestDir = path.join(outputDir, "latest");

  await Promise.all([
    mkdir(snapshotsDir, { recursive: true }),
    mkdir(rawDir, { recursive: true }),
    mkdir(normalizedDir, { recursive: true }),
    mkdir(latestDir, { recursive: true }),
  ]);

  const snapshotPath = path.join(snapshotsDir, `${runId}.json`);
  const rawPath = path.join(rawDir, `${runId}.json`);
  const normalizedPath = path.join(normalizedDir, `${runId}.json`);
  const latestSnapshotPath = path.join(latestDir, "snapshot.json");
  const latestRawPath = path.join(latestDir, "raw.json");
  const latestNormalizedPath = path.join(latestDir, "normalized.json");

  const writes = [
    writeJson(snapshotPath, input.snapshot),
    writeJson(rawPath, input.rawMarkets),
    writeJson(normalizedPath, input.normalizedMarkets),
    writeJson(latestSnapshotPath, input.snapshot),
    writeJson(latestRawPath, input.rawMarkets),
    writeJson(latestNormalizedPath, input.normalizedMarkets),
  ];

  await Promise.all(writes);

  return {
    runId,
    outputDir,
    snapshotPath,
    rawPath,
    normalizedPath,
    latestSnapshotPath,
    latestRawPath,
    latestNormalizedPath,
  };
}

