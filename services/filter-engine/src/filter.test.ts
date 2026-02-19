import type { Market } from "@coasensus/shared-types";
import { describe, expect, it } from "vitest";
import { curateMarkets } from "./filter.js";

const baseMarket: Market = {
  id: "1",
  question: "",
  description: null,
  url: "https://polymarket.com/example",
  endDate: null,
  liquidity: null,
  volume: null,
  openInterest: null,
  tags: [],
  createdAt: null,
  updatedAt: null,
};

describe("curateMarkets", () => {
  it("excludes meme-style markets", () => {
    const { curated, rejected } = curateMarkets([
      {
        ...baseMarket,
        id: "meme-1",
        question: "Will Doge meme coin 10x this week?",
        description: "pure meme trade",
        tags: ["meme"],
        volume: 45000,
      },
    ]);

    expect(curated).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.decisionReason).toContain("excluded");
  });

  it("includes civic and newsworthy markets", () => {
    const { curated } = curateMarkets([
      {
        ...baseMarket,
        id: "policy-1",
        question: "Will the senate pass the climate bill before July?",
        description: "federal policy vote",
        tags: ["policy", "climate"],
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        liquidity: 12000,
        volume: 88000,
        openInterest: 4000,
      },
    ]);

    expect(curated).toHaveLength(1);
    expect(curated[0]?.score.civicScore).toBeGreaterThanOrEqual(2);
    expect(curated[0]?.decisionReason).toBe("included_civic_and_news_threshold_met");
  });

  it("drops low-signal markets below thresholds", () => {
    const { curated, rejected } = curateMarkets([
      {
        ...baseMarket,
        id: "low-1",
        question: "Will this random event happen?",
        description: "no civic relevance",
        tags: ["other"],
        liquidity: 2,
        volume: 3,
      },
    ]);

    expect(curated).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.decisionReason).toBe("excluded_below_threshold");
  });

  it("rejects sports tournament markets even when liquid", () => {
    const { curated, rejected } = curateMarkets([
      {
        ...baseMarket,
        id: "sports-1",
        question: "Will Scottie Scheffler win the 2026 Masters tournament?",
        description: "Golf futures market",
        tags: ["golf", "masters"],
        liquidity: 65000,
        volume: 800000,
        openInterest: 15000,
      },
    ]);

    expect(curated).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.decisionReason).toContain("excluded");
  });

  it("does not misclassify generic 'who' phrasing as public health", () => {
    const { curated, rejected } = curateMarkets([
      {
        ...baseMarket,
        id: "who-phrase-1",
        question: "Who will win the spring city parade?",
        description: "Local entertainment event",
        tags: ["community"],
        liquidity: 9000,
        volume: 12000,
        openInterest: 2500,
      },
    ]);

    expect(curated).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.score.category).toBe("other");
  });
});
