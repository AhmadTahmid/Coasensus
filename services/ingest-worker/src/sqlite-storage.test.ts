import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadLatestNormalizedMarketsSqlite, persistIngestionRunSqlite } from "./sqlite-storage.js";

const tempPaths: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempPaths.map(async (target) => {
      await rm(target, { recursive: true, force: true });
    })
  );
  tempPaths.length = 0;
});

describe("sqlite persistence", () => {
  it("writes and reads latest normalized markets", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "coasensus-sqlite-"));
    tempPaths.push(tmpDir);
    const dbPath = path.join(tmpDir, "coasensus.sqlite");

    const persisted = await persistIngestionRunSqlite(
      {
        snapshot: {
          fetchedAt: "2026-02-19T13:40:00.000Z",
          pagesFetched: 2,
          rawCount: 2,
          normalizedCount: 1,
          droppedCount: 1,
        },
        rawMarkets: [
          { id: "raw-1", question: "raw q1" },
          { id: "raw-2", question: "raw q2" },
        ],
        normalizedMarkets: [
          {
            id: "norm-1",
            question: "Will senate pass climate bill?",
            description: null,
            url: "https://polymarket.com/event/norm-1",
            endDate: null,
            liquidity: 1000,
            volume: 5000,
            openInterest: 300,
            tags: ["policy"],
            createdAt: null,
            updatedAt: null,
          },
        ],
      },
      { dbPath }
    );

    expect(persisted.rawRows).toBe(2);
    expect(persisted.normalizedRows).toBe(1);

    const loaded = await loadLatestNormalizedMarketsSqlite({ dbPath });
    expect(loaded.runId).toBe(persisted.runId);
    expect(loaded.markets).toHaveLength(1);
    expect(loaded.markets[0]?.id).toBe("norm-1");
  });
});

