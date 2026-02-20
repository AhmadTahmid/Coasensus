export type SemanticCategory =
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

export interface SemanticOutput {
  isMeme: boolean;
  newsworthinessScore: number;
  category: SemanticCategory;
  geoTag: GeoTag;
  confidence: number;
}

const CATEGORY_SET = new Set<SemanticCategory>([
  "politics",
  "economy",
  "policy",
  "geopolitics",
  "public_health",
  "climate_energy",
  "tech_ai",
  "sports",
  "entertainment",
  "other",
]);

const GEO_SET = new Set<GeoTag>(["US", "EU", "Asia", "Africa", "MiddleEast", "World"]);

function toBool(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  return null;
}

function toScore(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }
  const rounded = Math.round(num);
  return rounded >= 1 && rounded <= 100 ? rounded : null;
}

function toCategory(value: unknown): SemanticCategory | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase().replace(/[\s/]+/g, "_");
  if (CATEGORY_SET.has(normalized as SemanticCategory)) {
    return normalized as SemanticCategory;
  }
  if (normalized === "tech" || normalized === "ai" || normalized === "science") {
    return "tech_ai";
  }
  if (normalized === "culture") {
    return "entertainment";
  }
  return null;
}

function toGeoTag(value: unknown): GeoTag | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  if (GEO_SET.has(normalized as GeoTag)) {
    return normalized as GeoTag;
  }
  return null;
}

function toConfidence(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }
  if (num < 0 || num > 1) {
    return null;
  }
  return num;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function parseSemanticOutput(value: unknown): SemanticOutput | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const isMeme = toBool(record.is_meme ?? record.isMeme);
  const newsworthinessScore = toScore(record.newsworthiness_score ?? record.newsworthinessScore);
  const category = toCategory(record.category);
  const geoTag = toGeoTag(record.geo_tag ?? record.geoTag);
  const confidence = toConfidence(record.confidence);

  if (isMeme === null || newsworthinessScore === null || category === null || geoTag === null || confidence === null) {
    return null;
  }

  return {
    isMeme,
    newsworthinessScore,
    category,
    geoTag,
    confidence,
  };
}

export function semanticJsonSchema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      is_meme: { type: "boolean" },
      newsworthiness_score: { type: "integer", minimum: 1, maximum: 100 },
      category: { type: "string", enum: [...CATEGORY_SET] },
      geo_tag: { type: "string", enum: [...GEO_SET] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
    required: ["is_meme", "newsworthiness_score", "category", "geo_tag", "confidence"],
  };
}
