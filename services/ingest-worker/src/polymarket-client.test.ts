import { describe, expect, it, vi } from "vitest";
import { fetchActiveMarkets } from "./polymarket-client.js";

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchActiveMarkets", () => {
  it("paginates and stops when a page is shorter than limit", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse([
          { id: "1", question: "Q1", active: true, closed: false, archived: false },
          { id: "2", question: "Q2", active: true, closed: false, archived: false },
        ])
      )
      .mockResolvedValueOnce(jsonResponse([{ id: "3", question: "Q3", active: true, closed: false, archived: false }]));

    const result = await fetchActiveMarkets({
      limitPerPage: 2,
      maxPages: 5,
      fetchImpl: fetchMock,
      retryBackoffMs: 0,
    });

    expect(result.pagesFetched).toBe(2);
    expect(result.markets.map((m) => m.id)).toEqual(["1", "2", "3"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries transient failures", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("network failed"))
      .mockResolvedValueOnce(jsonResponse([{ id: "ok-1", question: "Will policy pass?" }]));

    const result = await fetchActiveMarkets({
      limitPerPage: 50,
      maxPages: 1,
      retries: 1,
      retryBackoffMs: 0,
      fetchImpl: fetchMock,
    });

    expect(result.markets).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("deduplicates markets by id across pages", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse([
          { id: "dup", question: "A" },
          { id: "u1", question: "B" },
        ])
      )
      .mockResolvedValueOnce(jsonResponse([{ id: "dup", question: "A-again" }]));

    const result = await fetchActiveMarkets({
      limitPerPage: 2,
      maxPages: 2,
      fetchImpl: fetchMock,
      retryBackoffMs: 0,
    });

    expect(result.markets.map((m) => m.id)).toEqual(["dup", "u1"]);
  });
});

