import type { Market } from "@coasensus/shared-types";
import { describe, expect, it } from "vitest";
import { buildFeedFromMarkets, normalizeFeedQuery } from "./feed-store.js";

const mk = (id: string, question: string, volume: number, liquidity: number, tags: string[]): Market => ({
  id,
  question,
  description: "",
  url: `https://polymarket.com/event/${id}`,
  endDate: null,
  liquidity,
  volume,
  openInterest: 5000,
  tags,
  createdAt: null,
  updatedAt: null,
});

const markets: Market[] = [
  mk("a", "Will senate pass climate bill?", 100000, 20000, ["policy", "climate"]),
  mk("b", "Will US inflation be above 3%?", 90000, 15000, ["economy"]),
  mk("c", "Will doge meme coin spike this week?", 120000, 25000, ["meme"]),
];

describe("normalizeFeedQuery", () => {
  it("applies defaults and constraints", () => {
    const query = normalizeFeedQuery(new URLSearchParams("page=-1&pageSize=1000&sort=invalid"));
    expect(query.page).toBe(1);
    expect(query.pageSize).toBe(100);
    expect(query.sort).toBe("score");
  });
});

describe("buildFeedFromMarkets", () => {
  it("returns curated markets and paginates", () => {
    const feed = buildFeedFromMarkets(
      markets,
      {
        page: 1,
        pageSize: 1,
        sort: "score",
        includeRejected: false,
      },
      "test-source"
    );

    expect(feed.meta.totalItems).toBeGreaterThanOrEqual(1);
    expect(feed.items).toHaveLength(1);
    expect(feed.items[0]?.isCurated).toBe(true);
  });

  it("includes rejected markets when requested", () => {
    const feed = buildFeedFromMarkets(
      markets,
      {
        page: 1,
        pageSize: 20,
        sort: "volume",
        includeRejected: true,
      },
      "test-source"
    );

    const hasRejected = feed.items.some((item) => !item.isCurated);
    expect(hasRejected).toBe(true);
  });
});

