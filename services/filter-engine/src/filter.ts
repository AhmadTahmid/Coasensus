import type { CuratedFeedItem, Market, MarketCategory, MarketScoreBreakdown } from "@coasensus/shared-types";

const EXCLUSION_TOKENS = [
  "meme",
  "doge",
  "pepe",
  "gossip",
  "celebrity",
  "nba",
  "nfl",
  "soccer",
  "ufc",
  "crypto memecoin",
];

const CATEGORY_MAP: Record<MarketCategory, string[]> = {
  politics: ["election", "vote", "senate", "house", "president", "prime minister"],
  economy: ["inflation", "gdp", "recession", "unemployment", "federal reserve", "interest rate"],
  policy: ["bill", "law", "regulation", "policy", "court", "supreme court"],
  geopolitics: ["war", "conflict", "ceasefire", "sanction", "nato", "china", "russia", "taiwan"],
  public_health: ["pandemic", "vaccine", "cdc", "who", "outbreak", "public health"],
  climate_energy: ["climate", "emissions", "oil", "gas", "renewable", "energy", "carbon"],
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
  newsworthinessThreshold: 1,
};

function toCorpus(market: Market): string {
  return `${market.question} ${market.description ?? ""} ${market.tags.join(" ")}`.toLowerCase();
}

function isExcludedByToken(corpus: string): string | null {
  const token = EXCLUSION_TOKENS.find((item) => corpus.includes(item));
  return token ? `excluded_${token.replace(/\s+/g, "_")}` : null;
}

function detectCategory(corpus: string): MarketCategory {
  for (const [category, keywords] of Object.entries(CATEGORY_MAP) as [MarketCategory, string[]][]) {
    if (category === "other") {
      continue;
    }
    if (keywords.some((keyword) => corpus.includes(keyword))) {
      return category;
    }
  }
  return "other";
}

function scoreNewsworthiness(market: Market): number {
  let score = 0;

  if ((market.volume ?? 0) >= 10000) {
    score += 1;
  }
  if ((market.liquidity ?? 0) >= 5000) {
    score += 1;
  }
  if ((market.openInterest ?? 0) >= 2500) {
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

function scoreCivicRelevance(corpus: string, category: MarketCategory): number {
  let score = 0;
  const categoryKeywords = CATEGORY_MAP[category];

  if (category !== "other") {
    score += 1;
  }

  for (const token of categoryKeywords) {
    if (corpus.includes(token)) {
      score += 1;
    }
  }

  return score;
}

function createScoreBreakdown(market: Market): MarketScoreBreakdown {
  const corpus = toCorpus(market);
  const category = detectCategory(corpus);
  const civicScore = scoreCivicRelevance(corpus, category);
  const newsworthinessScore = scoreNewsworthiness(market);
  const reasonCodes: string[] = [];

  if (category !== "other") {
    reasonCodes.push(`category_${category}`);
  }
  if (newsworthinessScore > 0) {
    reasonCodes.push("news_signal_volume_or_liquidity");
  }

  return {
    civicScore,
    newsworthinessScore,
    category,
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

