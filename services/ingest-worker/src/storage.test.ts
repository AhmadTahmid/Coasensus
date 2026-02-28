import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { persistIngestionRun } from "./storage.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map(async (dir) => {
      await rm(dir, { recursive: true, force: true });
    })
  );
  tempDirs.length = 0;
});

describe("persistIngestionRun", () => {
  it("writes timestamped and latest artifacts", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "coasensus-ingest-"));
    tempDirs.push(dir);

    const persisted = await persistIngestionRun(
      {
        snapshot: {
          fetchedAt: "2026-02-19T12:00:00.000Z",
          pagesFetched: 2,
          rawCount: 3,
          normalizedCount: 2,
          droppedCount: 1,
          source: "rest_fallback",
        },
        rawMarkets: [{ id: "raw-1", question: "Raw Q1" }],
        normalizedMarkets: [
          {
            id: "norm-1",
            question: "Norm Q1",
            description: null,
            url: "https://polymarket.com/event/test",
            endDate: null,
            liquidity: null,
            volume: null,
            openInterest: null,
            tags: [],
            createdAt: null,
            updatedAt: null,
          },
        ],
      },
      {
        outputDir: dir,
      }
    );

    expect(persisted.runId).toBe("2026-02-19T12-00-00-000Z");

    const snapshotLatestRaw = await readFile(persisted.latestSnapshotPath, "utf8");
    const parsedSnapshot = JSON.parse(snapshotLatestRaw) as { rawCount: number };
    expect(parsedSnapshot.rawCount).toBe(3);

    const normalizedLatestRaw = await readFile(persisted.latestNormalizedPath, "utf8");
    const parsedNormalized = JSON.parse(normalizedLatestRaw) as Array<{ id: string }>;
    expect(parsedNormalized[0]?.id).toBe("norm-1");
  });
});
