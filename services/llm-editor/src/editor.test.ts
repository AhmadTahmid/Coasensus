import type { Market } from "@coasensus/shared-types";
import { describe, expect, it } from "vitest";
import { enrichMarketsWithCache, fingerprintMarket, type EditorClient, type SemanticCacheStore } from "./editor.js";
import { parseSemanticOutput } from "./schema.js";

const market: Market = {
  id: "m-1",
  question: "Will Congress pass a climate bill this year?",
  description: "US federal policy market",
  url: "https://example.com/m-1",
  endDate: "2026-12-31T00:00:00Z",
  liquidity: 30000,
  volume: 120000,
  openInterest: 8000,
  tags: ["policy", "climate", "us"],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-02-01T00:00:00Z",
};

describe("parseSemanticOutput", () => {
  it("accepts valid semantic JSON", () => {
    const parsed = parseSemanticOutput({
      is_meme: false,
      newsworthiness_score: 78,
      category: "policy",
      geo_tag: "US",
      confidence: 0.81,
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.category).toBe("policy");
  });

  it("rejects malformed semantic JSON", () => {
    const parsed = parseSemanticOutput({
      is_meme: "nope",
      newsworthiness_score: 200,
      category: "unknown",
      geo_tag: "Mars",
      confidence: 5,
    });

    expect(parsed).toBeNull();
  });
});

describe("enrichMarketsWithCache", () => {
  it("uses cache when fingerprint and promptVersion match", async () => {
    const fingerprint = fingerprintMarket(market, "v1");

    const cache: SemanticCacheStore = {
      async load() {
        return new Map([
          [
            "m-1",
            {
              marketId: "m-1",
              promptVersion: "v1",
              fingerprint,
              modelName: "llm-editor",
              rawJson: JSON.stringify({
                isMeme: false,
                newsworthinessScore: 70,
                category: "policy",
                geoTag: "US",
                confidence: 0.75,
              }),
              updatedAt: "2026-02-01T00:00:00Z",
            },
          ],
        ]);
      },
      async upsert() {
        // no-op
      },
    };

    const client: EditorClient = {
      async classify() {
        throw new Error("should not call classify on cache hit");
      },
    };

    const result = await enrichMarketsWithCache([market], cache, client, {
      promptVersion: "v1",
      maxLlmMarkets: 10,
      fallback: () => ({
        isMeme: false,
        newsworthinessScore: 50,
        category: "other",
        geoTag: "World",
        confidence: 0.4,
      }),
    });

    expect(result.summary.cacheHits).toBe(1);
    expect(result.summary.llmEvaluated).toBe(0);
    expect(result.byMarketId.get("m-1")).toBeDefined();
  });

  it("falls back when client fails", async () => {
    const cache: SemanticCacheStore = {
      async load() {
        return new Map();
      },
      async upsert() {
        // no-op
      },
    };

    const client: EditorClient = {
      async classify() {
        throw new Error("llm unavailable");
      },
    };

    const result = await enrichMarketsWithCache([market], cache, client, {
      promptVersion: "v1",
      maxLlmMarkets: 10,
      fallback: () => ({
        isMeme: false,
        newsworthinessScore: 55,
        category: "policy",
        geoTag: "US",
        confidence: 0.45,
      }),
    });

    expect(result.summary.llmFailures).toBe(1);
    expect(result.summary.fallbackEvaluated).toBe(1);
    expect(result.byMarketId.get("m-1")?.category).toBe("policy");
  });
});
