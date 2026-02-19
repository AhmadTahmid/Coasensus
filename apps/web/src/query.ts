export type FeedSort = "score" | "volume" | "liquidity" | "endDate";

export interface FeedRequestOptions {
  page: number;
  pageSize: number;
  sort: FeedSort;
  category: string;
  includeRejected: boolean;
}

function clampPositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value < 1) {
    return fallback;
  }
  return Math.floor(value);
}

export function buildFeedQueryString(input: Partial<FeedRequestOptions>): string {
  const page = clampPositiveInt(input.page ?? 1, 1);
  const pageSize = clampPositiveInt(input.pageSize ?? 20, 20);
  const sort = input.sort ?? "score";
  const category = (input.category ?? "").trim();
  const includeRejected = Boolean(input.includeRejected);

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(Math.min(pageSize, 100)));
  params.set("sort", sort);
  if (category.length > 0) {
    params.set("category", category);
  }
  if (includeRejected) {
    params.set("includeRejected", "1");
  }
  return params.toString();
}

