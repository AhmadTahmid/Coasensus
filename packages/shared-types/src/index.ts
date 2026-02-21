export type MarketCategory =
  | "politics"
  | "economy"
  | "policy"
  | "geopolitics"
  | "public_health"
  | "climate_energy"
  | "tech_ai"
  | "sports"
  | "entertainment"
  | "other";

export type GeoTag = "US" | "EU" | "Asia" | "Africa" | "MiddleEast" | "World";

export interface Market {
  id: string;
  question: string;
  description: string | null;
  url: string;
  endDate: string | null;
  liquidity: number | null;
  volume: number | null;
  openInterest: number | null;
  tags: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface MarketScoreBreakdown {
  civicScore: number;
  newsworthinessScore: number;
  category: MarketCategory;
  reasonCodes: string[];
}

export interface CuratedFeedItem extends Market {
  isCurated: boolean;
  decisionReason: string;
  geoTag?: GeoTag;
  score: MarketScoreBreakdown;
  frontPageScore?: number | null;
  trendDelta?: number | null;
}
