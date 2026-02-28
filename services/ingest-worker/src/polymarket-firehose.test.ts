import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SmartFirehoseClient,
  extractMarketUpdatesFromPayload,
  type WebSocketLike,
} from "./polymarket-firehose.js";

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

class FakeSocket implements WebSocketLike {
  private readonly listeners = new Map<string, Array<(event: unknown) => void>>();

  addEventListener(name: "open" | "message" | "close" | "error", listener: (event: unknown) => void): void {
    const list = this.listeners.get(name) ?? [];
    list.push(listener);
    this.listeners.set(name, list);
  }

  removeEventListener(name: "open" | "message" | "close" | "error", listener: (event: unknown) => void): void {
    const list = this.listeners.get(name) ?? [];
    this.listeners.set(
      name,
      list.filter((item) => item !== listener)
    );
  }

  send(data: string): void {
    void data;
    // noop for tests
  }

  close(code?: number, reason?: string): void {
    void code;
    void reason;
    this.emit("close", {});
  }

  emit(name: "open" | "message" | "close" | "error", event: unknown): void {
    for (const listener of this.listeners.get(name) ?? []) {
      listener(event);
    }
  }
}

const noopLogger = {
  info: () => {},
  warn: () => {},
};

afterEach(() => {
  vi.useRealTimers();
});

describe("extractMarketUpdatesFromPayload", () => {
  it("extracts updates from nested payloads and ignores ambiguous ids", () => {
    const updates = extractMarketUpdatesFromPayload({
      type: "market",
      events: [
        { market: "m1", price: "0.77" },
        { nested: { market_id: "m2", best_bid: "0.42", best_ask: "0.44" } },
        { id: "should-ignore-without-price" },
        { id: "m3", price: 0.33 },
      ],
    });

    const byId = new Map(updates.map((item) => [item.marketId, item]));
    expect(byId.get("m1")).toMatchObject({ lastTradePrice: 0.77, bestBid: null, bestAsk: null });
    expect(byId.get("m2")).toMatchObject({ lastTradePrice: null, bestBid: 0.42, bestAsk: 0.44 });
    expect(byId.get("m3")).toMatchObject({ lastTradePrice: 0.33, bestBid: null, bestAsk: null });
    expect(byId.has("should-ignore-without-price")).toBe(false);
  });
});

describe("SmartFirehoseClient", () => {
  it("uses a fresh firehose snapshot without REST fallback", async () => {
    let nowMs = 100;
    const bootstrapFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse([{ id: "1", question: "Q1", price: 0.1 }])
    );
    const fallbackFetch = vi.fn<typeof fetch>();

    const client = new SmartFirehoseClient({
      now: () => nowMs,
      logger: noopLogger,
    });

    await client.bootstrap({
      fetchImpl: bootstrapFetch,
      limitPerPage: 50,
      maxPages: 1,
      retryBackoffMs: 0,
    });

    nowMs = 1_000;
    const result = await client.fetchForIngestion(
      {
        fetchImpl: fallbackFetch,
        limitPerPage: 50,
        maxPages: 1,
        retryBackoffMs: 0,
      },
      5_000
    );

    expect(result.source).toBe("firehose_snapshot");
    expect(result.pagesFetched).toBe(0);
    expect(result.markets.map((market) => market.id)).toEqual(["1"]);
    expect(fallbackFetch).not.toHaveBeenCalled();
  });

  it("falls back to REST when snapshot is stale", async () => {
    let nowMs = 100;
    const bootstrapFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse([{ id: "1", question: "Q1", price: 0.1 }])
    );
    const fallbackFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse([{ id: "2", question: "Q2", price: 0.2 }])
    );

    const client = new SmartFirehoseClient({
      now: () => nowMs,
      logger: noopLogger,
    });

    await client.bootstrap({
      fetchImpl: bootstrapFetch,
      limitPerPage: 50,
      maxPages: 1,
      retryBackoffMs: 0,
    });

    nowMs = 90_000;
    const result = await client.fetchForIngestion(
      {
        fetchImpl: fallbackFetch,
        limitPerPage: 50,
        maxPages: 1,
        retryBackoffMs: 0,
      },
      2_000
    );

    expect(result.source).toBe("rest_fallback");
    expect(result.markets.map((market) => market.id)).toEqual(["2"]);
    expect(fallbackFetch).toHaveBeenCalledTimes(1);
  });

  it("applies websocket price updates to the existing snapshot", async () => {
    let nowMs = 0;
    const socket = new FakeSocket();
    const bootstrapFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse([{ id: "101", question: "Q101", price: 0.2, lastTradePrice: 0.2 }])
    );

    const client = new SmartFirehoseClient({
      now: () => nowMs,
      connectImpl: () => socket,
      logger: noopLogger,
    });

    await client.bootstrap({
      fetchImpl: bootstrapFetch,
      limitPerPage: 50,
      maxPages: 1,
      retryBackoffMs: 0,
    });
    client.start();

    socket.emit("open", {});
    nowMs = 2_000;
    socket.emit("message", {
      data: JSON.stringify({
        channel: "market",
        market: "101",
        price: 0.73,
      }),
    });

    const snapshot = client.getSnapshot(60_000);
    const market = snapshot.markets.find((item) => String(item.id ?? item.marketId) === "101");
    expect(snapshot.source).toBe("websocket");
    expect(snapshot.stats.updatesApplied).toBeGreaterThanOrEqual(1);
    expect(market?.lastTradePrice).toBe(0.73);
    expect(market?.price).toBe(0.73);

    client.stop();
  });

  it("reconnects with backoff after socket close", () => {
    vi.useFakeTimers();

    const socketOne = new FakeSocket();
    const socketTwo = new FakeSocket();
    const sockets = [socketOne, socketTwo];
    const connectImpl = vi.fn(() => sockets.shift() ?? new FakeSocket());

    const client = new SmartFirehoseClient({
      connectImpl,
      reconnectBaseMs: 50,
      reconnectMaxMs: 500,
      logger: noopLogger,
    });

    client.start();
    expect(connectImpl).toHaveBeenCalledTimes(1);

    socketOne.emit("close", {});
    vi.advanceTimersByTime(49);
    expect(connectImpl).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(connectImpl).toHaveBeenCalledTimes(2);

    client.stop();
  });
});
