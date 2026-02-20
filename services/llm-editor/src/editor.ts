import type { Market } from "@coasensus/shared-types";
import type { SemanticOutput } from "./schema.js";

export interface EditorPrompt {
  system: string;
  user: string;
}

export interface EditorClient {
  classify(input: { market: Market; promptVersion: string; prompt: EditorPrompt }): Promise<SemanticOutput>;
}

export interface SemanticCacheRow {
  marketId: string;
  promptVersion: string;
  fingerprint: string;
  modelName: string;
  rawJson: string;
  updatedAt: string;
}

export interface SemanticCacheStore {
  load(marketIds: string[]): Promise<Map<string, SemanticCacheRow>>;
  upsert(rows: SemanticCacheRow[]): Promise<void>;
}

export interface EnrichmentOptions {
  promptVersion: string;
  maxLlmMarkets: number;
  fallback: (market: Market) => SemanticOutput;
}

export interface EnrichmentSummary {
  cacheHits: number;
  cacheMisses: number;
  llmEvaluated: number;
  fallbackEvaluated: number;
  llmFailures: number;
}

export interface EnrichmentResult {
  byMarketId: Map<string, SemanticOutput>;
  summary: EnrichmentSummary;
}

export function buildEditorPrompt(market: Market, promptVersion: string): EditorPrompt {
  return {
    system:
      "You are the Editor-in-Chief of a predictive news platform. Return JSON only with is_meme, newsworthiness_score, category, geo_tag, confidence.",
    user: JSON.stringify({
      prompt_version: promptVersion,
      market: {
        id: market.id,
        question: market.question,
        description: market.description,
        tags: market.tags,
        liquidity: market.liquidity,
        volume: market.volume,
        open_interest: market.openInterest,
        end_date: market.endDate,
      },
    }),
  };
}

export function fingerprintMarket(market: Market, promptVersion: string): string {
  const input = `${promptVersion}|${market.question.toLowerCase()}|${(market.description ?? "").toLowerCase()}|${market.tags
    .join(",")
    .toLowerCase()}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export async function enrichMarketsWithCache(
  markets: Market[],
  cache: SemanticCacheStore,
  client: EditorClient,
  options: EnrichmentOptions
): Promise<EnrichmentResult> {
  const byMarketId = new Map<string, SemanticOutput>();
  const cacheRows = await cache.load(markets.map((m) => m.id));

  let cacheHits = 0;
  let llmEvaluated = 0;
  let fallbackEvaluated = 0;
  let llmFailures = 0;

  const upserts: SemanticCacheRow[] = [];

  for (const market of markets) {
    const fp = fingerprintMarket(market, options.promptVersion);
    const cached = cacheRows.get(market.id);
    if (cached && cached.promptVersion === options.promptVersion && cached.fingerprint === fp) {
      try {
        byMarketId.set(market.id, JSON.parse(cached.rawJson) as SemanticOutput);
        cacheHits += 1;
        continue;
      } catch {
        // fall through and reclassify
      }
    }

    let classified: SemanticOutput;
    if (llmEvaluated < options.maxLlmMarkets) {
      try {
        classified = await client.classify({
          market,
          promptVersion: options.promptVersion,
          prompt: buildEditorPrompt(market, options.promptVersion),
        });
        llmEvaluated += 1;
      } catch {
        classified = options.fallback(market);
        fallbackEvaluated += 1;
        llmFailures += 1;
      }
    } else {
      classified = options.fallback(market);
      fallbackEvaluated += 1;
    }

    byMarketId.set(market.id, classified);
    upserts.push({
      marketId: market.id,
      promptVersion: options.promptVersion,
      fingerprint: fp,
      modelName: "llm-editor",
      rawJson: JSON.stringify(classified),
      updatedAt: new Date().toISOString(),
    });
  }

  if (upserts.length > 0) {
    await cache.upsert(upserts);
  }

  return {
    byMarketId,
    summary: {
      cacheHits,
      cacheMisses: markets.length - cacheHits,
      llmEvaluated,
      fallbackEvaluated,
      llmFailures,
    },
  };
}
