import { describe, expect, it } from "vitest";
import { normalizeActiveMarkets, normalizeMarket } from "./normalize.js";

describe("normalizeMarket", () => {
  it("maps common polymarket fields into canonical shape", () => {
    const normalized = normalizeMarket({
      marketId: "abc-123",
      title: "Will inflation be above 3% by June?",
      description: "CPI release probability",
      slug: "will-inflation-be-above-3-by-june",
      end_date: "2026-06-30T00:00:00Z",
      liquidityNum: "12500.5",
      volumeNum: "34000",
      open_interest: "9800",
      outcomes: '["Yes","No"]',
      outcomePrices: '["0.61","0.39"]',
      tags: "economy,macro",
    });

    expect(normalized.id).toBe("abc-123");
    expect(normalized.question).toContain("inflation");
    expect(normalized.url).toContain("/event/will-inflation-be-above-3-by-june");
    expect(normalized.liquidity).toBe(12500.5);
    expect(normalized.volume).toBe(34000);
    expect(normalized.openInterest).toBe(9800);
    expect(normalized.probability).toBe(0.61);
    expect(normalized.tags).toEqual(["economy", "macro"]);
  });

  it("pulls fallback tags and url from event metadata", () => {
    const normalized = normalizeMarket({
      id: "evt-1",
      question: "Will congress pass the bill?",
      events: [
        {
          slug: "congress-bill-vote",
          tags: ["policy", "politics"],
          openInterest: "1234",
        },
      ],
    });

    expect(normalized.url).toBe("https://polymarket.com/event/congress-bill-vote");
    expect(normalized.tags).toEqual(["policy", "politics"]);
    expect(normalized.openInterest).toBe(1234);
  });

  it("only trusts polymarket links and falls back when direct url is external", () => {
    const normalized = normalizeMarket({
      id: "evt-2",
      question: "Will CPI print below 3%?",
      url: "https://example.com/not-polymarket",
      slug: "cpi-below-3",
      lastTradePrice: "0.48",
    });

    expect(normalized.url).toBe("https://polymarket.com/event/cpi-below-3");
    expect(normalized.probability).toBe(0.48);
  });

  it("throws when id or question is missing", () => {
    expect(() =>
      normalizeMarket({
        title: "Missing id",
      })
    ).toThrow();

    expect(() =>
      normalizeMarket({
        id: "x",
      })
    ).toThrow();
  });
});

describe("normalizeActiveMarkets", () => {
  it("drops invalid records while keeping valid markets", () => {
    const result = normalizeActiveMarkets([
      {
        id: "ok-1",
        question: "Will a new climate bill pass this quarter?",
      },
      {
        id: "",
        question: "broken",
      },
      null,
    ]);

    expect(result.markets).toHaveLength(1);
    expect(result.dropped).toBe(2);
  });
});
