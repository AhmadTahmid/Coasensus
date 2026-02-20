import type { CuratedFeedItem, Market, MarketCategory, MarketScoreBreakdown } from "@coasensus/shared-types";

const EXCLUSION_TOKENS = [
  "meme",
  "doge",
  "pepe",
  "gossip",
  "celebrity",
  "james bond",
  "oscar",
  "grammy",
  "box office",
  "movie",
  "tv show",
  "super bowl",
  "world cup",
  "championship",
  "tournament",
  "masters",
  "golf",
  "tennis",
  "formula 1",
  "f1",
  "basketball",
  "football",
  "baseball",
  "hockey",
  "nba",
  "nfl",
  "soccer",
  "mlb",
  "nhl",
  "ufc",
  "crypto memecoin",
];

const CATEGORY_MAP: Record<MarketCategory, string[]> = {
  politics: ["election", "vote", "senate", "house", "president", "prime minister"],
  economy: ["inflation", "gdp", "recession", "unemployment", "federal reserve", "interest rate"],
  policy: ["bill", "law", "regulation", "policy", "court", "supreme court"],
  geopolitics: ["war", "conflict", "ceasefire", "sanction", "nato", "china", "russia", "taiwan"],
  public_health: ["pandemic", "vaccine", "cdc", "outbreak", "public health", "hospital", "epidemic"],
  climate_energy: ["climate", "emissions", "oil", "gas", "renewable", "energy", "carbon"],
  tech_ai: ["ai", "artificial intelligence", "openai", "anthropic", "google", "chip", "gpu", "robotics"],
  sports: ["sports", "tournament", "league", "championship", "playoff", "final"],
  entertainment: ["movie", "music", "celebrity", "award", "oscar", "grammy", "tv"],
  other: [],
};

export interface CurationOptions {
  civicThreshold: number;
  newsworthinessThreshold: number;
}

export interface CurationResult {
  curated: CuratedFeedItem[];
  rejected: CuratedFeedItem[];
}

const DEFAULT_OPTIONS: CurationOptions = {
  civicThreshold: 2,
  newsworthinessThreshold: 2,
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keywordPattern(keyword: string): RegExp {
  const escaped = escapeRegex(keyword.toLowerCase()).replace(/\\\s+/g, "\\s+");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

function hasKeyword(corpus: string, keyword: string): boolean {
  return keywordPattern(keyword).test(corpus);
}

function matchedKeywords(corpus: string, keywords: string[]): string[] {
  return keywords.filter((keyword) => hasKeyword(corpus, keyword));
}

function toCorpus(market: Market): string {
  return `${market.question} ${market.description ?? ""} ${market.tags.join(" ")}`.toLowerCase();
}

function isExcludedByToken(corpus: string): string | null {
  const token = EXCLUSION_TOKENS.find((item) => hasKeyword(corpus, item));
  return token ? `excluded_${token.replace(/\s+/g, "_")}` : null;
}

function detectCategory(corpus: string): { category: MarketCategory; keywords: string[] } {
  let bestCategory: MarketCategory = "other";
  let bestKeywords: string[] = [];

  for (const [category, keywords] of Object.entries(CATEGORY_MAP) as [MarketCategory, string[]][]) {
    if (category === "other") {
      continue;
    }
    const matches = matchedKeywords(corpus, keywords);
    if (matches.length > bestKeywords.length) {
      bestCategory = category;
      bestKeywords = matches;
    }
  }

  return { category: bestCategory, keywords: bestKeywords };
}

function scoreNewsworthiness(market: Market): number {
  let score = 0;

  if ((market.volume ?? 0) >= 25000) {
    score += 1;
  }
  if ((market.liquidity ?? 0) >= 10000) {
    score += 1;
  }
  if ((market.openInterest ?? 0) >= 5000) {
    score += 1;
  }
  if ((market.volume ?? 0) >= 250000 || (market.liquidity ?? 0) >= 50000) {
    score += 1;
  }

  if (market.endDate) {
    const endTime = new Date(market.endDate).getTime();
    if (!Number.isNaN(endTime)) {
      const daysToResolve = (endTime - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysToResolve >= 0 && daysToResolve <= 14) {
        score += 1;
      }
    }
  }

  return score;
}

function scoreCivicRelevance(category: MarketCategory, keywords: string[]): number {
  if (category !== "other") {
    return 1 + keywords.length;
  }
  return 0;
}

function createScoreBreakdown(market: Market): MarketScoreBreakdown {
  const corpus = toCorpus(market);
  const detected = detectCategory(corpus);
  const civicScore = scoreCivicRelevance(detected.category, detected.keywords);
  const newsworthinessScore = scoreNewsworthiness(market);
  const reasonCodes: string[] = [];

  if (detected.category !== "other") {
    reasonCodes.push(`category_${detected.category}`);
    for (const keyword of detected.keywords.slice(0, 2)) {
      reasonCodes.push(`keyword_${keyword.replace(/\s+/g, "_")}`);
    }
  }
  if (newsworthinessScore >= 2) {
    reasonCodes.push("news_signal_volume_or_liquidity");
  }

  return {
    civicScore,
    newsworthinessScore,
    category: detected.category,
    reasonCodes,
  };
}

export function curateMarkets(markets: Market[], options?: Partial<CurationOptions>): CurationResult {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const curated: CuratedFeedItem[] = [];
  const rejected: CuratedFeedItem[] = [];

  for (const market of markets) {
    const corpus = toCorpus(market);
    const exclusionReason = isExcludedByToken(corpus);
    const score = createScoreBreakdown(market);

    let isCurated = false;
    let decisionReason = "excluded_below_threshold";

    if (exclusionReason) {
      decisionReason = exclusionReason;
    } else if (
      score.civicScore >= config.civicThreshold &&
      score.newsworthinessScore >= config.newsworthinessThreshold
    ) {
      isCurated = true;
      decisionReason = "included_civic_and_news_threshold_met";
    }

    const item: CuratedFeedItem = {
      ...market,
      isCurated,
      decisionReason,
      score,
    };

    if (isCurated) {
      curated.push(item);
    } else {
      rejected.push(item);
    }
  }

  curated.sort((a, b) => b.score.civicScore + b.score.newsworthinessScore - (a.score.civicScore + a.score.newsworthinessScore));

  return { curated, rejected };
}
