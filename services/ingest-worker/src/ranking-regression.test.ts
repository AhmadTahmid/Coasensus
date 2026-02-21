import type { Market, MarketCategory } from "@coasensus/shared-types";
import { describe, expect, it } from "vitest";
import { buildFeedFromMarkets, normalizeFeedQuery } from "./feed-store.js";

function mk(
  id: string,
  overrides: Partial<Market> = {}
): Market {
  return {
    id,
    question: "Will senate pass the budget bill?",
    description: "",
    url: `https://polymarket.com/event/${id}`,
    endDate: null,
    liquidity: 12_000,
    volume: 30_000,
    openInterest: 5_000,
    tags: ["policy"],
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

function ids(markets: Array<{ id: string }>): string[] {
  return markets.map((item) => item.id);
}

describe("ranking regression suite", () => {
  it("accepts expanded category filters in query parsing", () => {
    const categories: MarketCategory[] = ["tech_ai", "sports", "entertainment"];
    for (const category of categories) {
      const query = normalizeFeedQuery(new URLSearchParams(`category=${category}`));
      expect(query.category).toBe(category);
    }
  });

  it("uses deterministic id tie-break for score sort", () => {
    const markets: Market[] = [mk("c"), mk("a"), mk("b")];
    const feed = buildFeedFromMarkets(
      markets,
      {
        page: 1,
        pageSize: 20,
        sort: "score",
        includeRejected: true,
      },
      "ranking-regression"
    );

    expect(ids(feed.items)).toEqual(["a", "b", "c"]);
  });

  it("uses deterministic id tie-break for volume sort, with null values last", () => {
    const markets: Market[] = [
      mk("c", { volume: 100_000 }),
      mk("a", { volume: 100_000 }),
      mk("b", { volume: 90_000 }),
      mk("d", { volume: null }),
    ];

    const feed = buildFeedFromMarkets(
      markets,
      {
        page: 1,
        pageSize: 20,
        sort: "volume",
        includeRejected: true,
      },
      "ranking-regression"
    );

    expect(ids(feed.items)).toEqual(["a", "c", "b", "d"]);
  });

  it("uses deterministic id tie-break for liquidity sort, with null values last", () => {
    const markets: Market[] = [
      mk("c", { liquidity: 25_000 }),
      mk("a", { liquidity: 25_000 }),
      mk("b", { liquidity: 20_000 }),
      mk("d", { liquidity: null }),
    ];

    const feed = buildFeedFromMarkets(
      markets,
      {
        page: 1,
        pageSize: 20,
        sort: "liquidity",
        includeRejected: true,
      },
      "ranking-regression"
    );

    expect(ids(feed.items)).toEqual(["a", "c", "b", "d"]);
  });

  it("sorts endDate ascending, applies id tie-break, and places null endDate last", () => {
    const markets: Market[] = [
      mk("b", { endDate: "2026-01-02T00:00:00Z" }),
      mk("a", { endDate: "2026-01-02T00:00:00Z" }),
      mk("c", { endDate: "2026-02-01T00:00:00Z" }),
      mk("d", { endDate: null }),
    ];

    const feed = buildFeedFromMarkets(
      markets,
      {
        page: 1,
        pageSize: 20,
        sort: "endDate",
        includeRejected: true,
      },
      "ranking-regression"
    );

    expect(ids(feed.items)).toEqual(["a", "b", "c", "d"]);
  });

  it("clamps page to totalPages while preserving ranking order", () => {
    const markets: Market[] = [
      mk("a", { volume: 120_000 }),
      mk("b", { volume: 110_000 }),
      mk("c", { volume: 100_000 }),
      mk("d", { volume: 90_000 }),
    ];

    const feed = buildFeedFromMarkets(
      markets,
      {
        page: 99,
        pageSize: 2,
        sort: "volume",
        includeRejected: true,
      },
      "ranking-regression"
    );

    expect(feed.meta.totalPages).toBe(2);
    expect(feed.meta.page).toBe(2);
    expect(ids(feed.items)).toEqual(["c", "d"]);
  });
});

