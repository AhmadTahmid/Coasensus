import { describe, expect, it } from "vitest";
import { buildFeedQueryString } from "./query.js";

describe("buildFeedQueryString", () => {
  it("builds default query parameters", () => {
    const query = buildFeedQueryString({});
    expect(query).toContain("page=1");
    expect(query).toContain("pageSize=20");
    expect(query).toContain("sort=score");
  });

  it("includes optional category and rejected flag", () => {
    const query = buildFeedQueryString({
      page: 3,
      pageSize: 50,
      sort: "volume",
      category: "policy",
      search: " election forecast ",
      includeRejected: true,
    });

    expect(query).toContain("page=3");
    expect(query).toContain("pageSize=50");
    expect(query).toContain("sort=volume");
    expect(query).toContain("category=policy");
    expect(query).toContain("q=election+forecast");
    expect(query).toContain("includeRejected=1");
  });

  it("omits empty search query", () => {
    const query = buildFeedQueryString({ search: "   " });
    expect(query).not.toContain("q=");
  });
});
