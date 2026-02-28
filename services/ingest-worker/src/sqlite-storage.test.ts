import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listAnalyticsEventsSqlite,
  loadLatestNormalizedMarketsSqlite,
  persistAnalyticsEventSqlite,
  persistIngestionRunSqlite,
} from "./sqlite-storage.js";

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
          source: "rest_fallback",
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

  it("stores and lists analytics events", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "coasensus-analytics-"));
    tempPaths.push(tmpDir);
    const dbPath = path.join(tmpDir, "coasensus.sqlite");

    const stored = await persistAnalyticsEventSqlite(
      {
        event: "page_view",
        source: "web",
        sessionId: "session-1",
        pageUrl: "http://localhost:3000",
        details: { page: "home" },
      },
      { dbPath }
    );

    expect(stored.id).toBeGreaterThan(0);
    expect(stored.event).toBe("page_view");

    const events = await listAnalyticsEventsSqlite(10, { dbPath });
    expect(events).toHaveLength(1);
    expect(events[0]?.event).toBe("page_view");
    expect(events[0]?.details.page).toBe("home");
  });
});
