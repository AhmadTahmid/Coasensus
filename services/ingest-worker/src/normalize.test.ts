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
      tags: "economy,macro",
    });

    expect(normalized.id).toBe("abc-123");
    expect(normalized.question).toContain("inflation");
    expect(normalized.url).toContain("/event/will-inflation-be-above-3-by-june");
    expect(normalized.liquidity).toBe(12500.5);
    expect(normalized.volume).toBe(34000);
    expect(normalized.openInterest).toBe(9800);
    expect(normalized.tags).toEqual(["economy", "macro"]);
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

