import { logInfo, logWarn } from "./logger.js";
import {
  fetchActiveMarkets,
  type ActiveMarketsFetchResult,
  type PolymarketFetchOptions,
} from "./polymarket-client.js";
import type { RawPolymarketMarket } from "./normalize.js";

export const DEFAULT_POLYMARKET_MARKET_WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";
const DEFAULT_SNAPSHOT_MAX_STALENESS_MS = 90_000;
const DEFAULT_RECONNECT_BASE_MS = 800;
const DEFAULT_RECONNECT_MAX_MS = 15_000;

const MARKET_ID_PRIMARY_KEYS = ["market", "market_id", "marketId", "condition_id", "conditionId", "token_id", "tokenId"];
const MARKET_ID_FALLBACK_KEYS = ["id"];
const LAST_TRADE_PRICE_KEYS = ["last_trade_price", "lastTradePrice", "price", "p"];
const BEST_BID_KEYS = ["best_bid", "bestBid", "bid"];
const BEST_ASK_KEYS = ["best_ask", "bestAsk", "ask"];

type ListenerName = "open" | "message" | "close" | "error";

export type FirehoseIngestionSource = "firehose_snapshot" | "rest_fallback";

export interface FirehoseStats {
  messages: number;
  parseFailures: number;
  updatesApplied: number;
  unknownMarketUpdates: number;
  reconnects: number;
  restBootstraps: number;
  restFallbacks: number;
}

export interface FirehoseSnapshot {
  source: "none" | "rest_bootstrap" | "websocket";
  updatedAt: string | null;
  updatedAtMs: number;
  marketCount: number;
  isFresh: boolean;
  wsConnected: boolean;
  markets: RawPolymarketMarket[];
  stats: FirehoseStats;
}

export interface FirehoseFetchResult extends ActiveMarketsFetchResult {
  source: FirehoseIngestionSource;
}

export interface MarketChannelUpdate {
  marketId: string;
  lastTradePrice: number | null;
  bestBid: number | null;
  bestAsk: number | null;
}

export interface WebSocketLike {
  addEventListener(name: ListenerName, listener: (event: unknown) => void): void;
  removeEventListener(name: ListenerName, listener: (event: unknown) => void): void;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

export interface SmartFirehoseLogger {
  info(event: string, details?: Record<string, unknown>): void;
  warn(event: string, details?: Record<string, unknown>): void;
}

export interface SmartFirehoseOptions {
  websocketUrl?: string;
  subscriptionMessage?: Record<string, unknown> | null;
  snapshotMaxStalenessMs?: number;
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  connectImpl?: WebSocketFactory;
  now?: () => number;
  logger?: SmartFirehoseLogger;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asNumberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asStringId(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function toIsoDate(ms: number): string {
  return new Date(ms).toISOString();
}

function deepCollectRecords(input: unknown, maxDepth = 6): Record<string, unknown>[] {
  const collected: Record<string, unknown>[] = [];
  const seen = new Set<object>();

  function walk(value: unknown, depth: number): void {
    if (depth > maxDepth || value === null || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item, depth + 1);
      }
      return;
    }

    const record = asRecord(value);
    if (!record) {
      return;
    }

    if (seen.has(record)) {
      return;
    }
    seen.add(record);
    collected.push(record);

    for (const nested of Object.values(record)) {
      walk(nested, depth + 1);
    }
  }

  walk(input, 0);
  return collected;
}

function pickFirstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = asStringId(record[key]);
    if (value) {
      return value;
    }
  }
  return null;
}

function pickFirstNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = asNumberOrNull(record[key]);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

function messageEventToText(event: unknown): string | null {
  const maybeEvent = asRecord(event);
  const payload = maybeEvent && "data" in maybeEvent ? maybeEvent.data : event;

  if (typeof payload === "string") {
    return payload;
  }
  if (payload instanceof ArrayBuffer) {
    return new TextDecoder().decode(payload);
  }
  if (payload instanceof Uint8Array) {
    return new TextDecoder().decode(payload);
  }
  if (payload && typeof payload === "object" && "toString" in payload) {
    const maybeString = String(payload);
    return maybeString.length > 0 ? maybeString : null;
  }
  return null;
}

function defaultWebSocketFactory(url: string): WebSocketLike {
  const ctor = (globalThis as { WebSocket?: new (input: string) => WebSocketLike }).WebSocket;
  if (!ctor) {
    throw new Error("WebSocket is unavailable in this runtime");
  }
  return new ctor(url);
}

function computeReconnectDelay(attempt: number, baseMs: number, maxMs: number): number {
  const exponent = Math.max(0, attempt - 1);
  const raw = baseMs * 2 ** exponent;
  return Math.min(maxMs, raw);
}

export function extractMarketUpdatesFromPayload(payload: unknown): MarketChannelUpdate[] {
  const records = deepCollectRecords(payload);
  const byMarketId = new Map<string, MarketChannelUpdate>();

  for (const record of records) {
    const primaryId = pickFirstString(record, MARKET_ID_PRIMARY_KEYS);
    const fallbackId = pickFirstString(record, MARKET_ID_FALLBACK_KEYS);
    const marketId = primaryId ?? fallbackId;
    if (!marketId) {
      continue;
    }

    const lastTradePrice = pickFirstNumber(record, LAST_TRADE_PRICE_KEYS);
    const bestBid = pickFirstNumber(record, BEST_BID_KEYS);
    const bestAsk = pickFirstNumber(record, BEST_ASK_KEYS);
    const hasPriceSignal = lastTradePrice !== null || bestBid !== null || bestAsk !== null;

    // `id` is too generic, so only trust fallback ids when price fields are present.
    if (!primaryId && !hasPriceSignal) {
      continue;
    }

    byMarketId.set(marketId, {
      marketId,
      lastTradePrice,
      bestBid,
      bestAsk,
    });
  }

  return [...byMarketId.values()];
}

export class SmartFirehoseClient {
  private readonly websocketUrl: string;
  private readonly subscriptionMessage: Record<string, unknown> | null;
  private readonly snapshotMaxStalenessMs: number;
  private readonly reconnectBaseMs: number;
  private readonly reconnectMaxMs: number;
  private readonly connectImpl: WebSocketFactory;
  private readonly now: () => number;
  private readonly logger: SmartFirehoseLogger;

  private readonly marketsById = new Map<string, RawPolymarketMarket>();
  private readonly stats: FirehoseStats = {
    messages: 0,
    parseFailures: 0,
    updatesApplied: 0,
    unknownMarketUpdates: 0,
    reconnects: 0,
    restBootstraps: 0,
    restFallbacks: 0,
  };

  private socket: WebSocketLike | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private started = false;
  private wsConnected = false;
  private updatedAtMs = 0;
  private source: "none" | "rest_bootstrap" | "websocket" = "none";

  private readonly onSocketOpen = (): void => {
    this.wsConnected = true;
    this.reconnectAttempts = 0;
    this.logger.info("ingest.firehose.connected", { websocketUrl: this.websocketUrl });

    if (!this.subscriptionMessage || !this.socket) {
      return;
    }

    try {
      this.socket.send(JSON.stringify(this.subscriptionMessage));
      this.logger.info("ingest.firehose.subscribed", {
        websocketUrl: this.websocketUrl,
        mode: "manual_subscription",
      });
    } catch (error) {
      this.logger.warn("ingest.firehose.subscribe_failed", {
        websocketUrl: this.websocketUrl,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  };

  private readonly onSocketMessage = (event: unknown): void => {
    this.stats.messages += 1;
    const text = messageEventToText(event);
    if (!text) {
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      this.stats.parseFailures += 1;
      return;
    }

    const updates = extractMarketUpdatesFromPayload(payload);
    if (updates.length === 0) {
      return;
    }

    let applied = 0;
    for (const update of updates) {
      if (this.applyMarketUpdate(update)) {
        applied += 1;
      }
    }

    if (applied > 0) {
      this.markUpdated("websocket");
    }
  };

  private readonly onSocketClose = (): void => {
    this.wsConnected = false;
    this.detachSocketListeners();
    if (this.started) {
      this.scheduleReconnect("close");
    }
  };

  private readonly onSocketError = (): void => {
    this.wsConnected = false;
    if (this.started) {
      this.scheduleReconnect("error");
    }
  };

  constructor(options: SmartFirehoseOptions = {}) {
    this.websocketUrl = options.websocketUrl ?? DEFAULT_POLYMARKET_MARKET_WS_URL;
    this.subscriptionMessage = options.subscriptionMessage ?? null;
    this.snapshotMaxStalenessMs = options.snapshotMaxStalenessMs ?? DEFAULT_SNAPSHOT_MAX_STALENESS_MS;
    this.reconnectBaseMs = options.reconnectBaseMs ?? DEFAULT_RECONNECT_BASE_MS;
    this.reconnectMaxMs = options.reconnectMaxMs ?? DEFAULT_RECONNECT_MAX_MS;
    this.connectImpl = options.connectImpl ?? defaultWebSocketFactory;
    this.now = options.now ?? (() => Date.now());
    this.logger = options.logger ?? { info: logInfo, warn: logWarn };
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.openSocket();
  }

  stop(): void {
    this.started = false;
    this.wsConnected = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close(1000, "smart firehose stopped");
      } catch {
        // Best effort close.
      }
    }
    this.detachSocketListeners();
  }

  async bootstrap(fetchOptions: PolymarketFetchOptions = {}): Promise<ActiveMarketsFetchResult> {
    const fetched = await fetchActiveMarkets(fetchOptions);
    this.replaceSnapshot(fetched.markets, "rest_bootstrap");
    this.stats.restBootstraps += 1;
    return fetched;
  }

  getSnapshot(maxStalenessMs = this.snapshotMaxStalenessMs): FirehoseSnapshot {
    const ageMs = this.updatedAtMs > 0 ? Math.max(0, this.now() - this.updatedAtMs) : Number.POSITIVE_INFINITY;
    const isFresh = this.marketsById.size > 0 && ageMs <= Math.max(1, maxStalenessMs);
    return {
      source: this.source,
      updatedAt: this.updatedAtMs > 0 ? toIsoDate(this.updatedAtMs) : null,
      updatedAtMs: this.updatedAtMs,
      marketCount: this.marketsById.size,
      isFresh,
      wsConnected: this.wsConnected,
      markets: [...this.marketsById.values()],
      stats: { ...this.stats },
    };
  }

  async fetchForIngestion(
    fetchOptions: PolymarketFetchOptions = {},
    maxStalenessMs = this.snapshotMaxStalenessMs
  ): Promise<FirehoseFetchResult> {
    const snapshot = this.getSnapshot(maxStalenessMs);
    if (snapshot.isFresh) {
      return {
        markets: snapshot.markets,
        pagesFetched: 0,
        source: "firehose_snapshot",
      };
    }

    const fallback = await this.bootstrap(fetchOptions);
    this.stats.restFallbacks += 1;
    return {
      ...fallback,
      source: "rest_fallback",
    };
  }

  private openSocket(): void {
    if (!this.started || this.socket) {
      return;
    }

    try {
      this.socket = this.connectImpl(this.websocketUrl);
      this.socket.addEventListener("open", this.onSocketOpen);
      this.socket.addEventListener("message", this.onSocketMessage);
      this.socket.addEventListener("close", this.onSocketClose);
      this.socket.addEventListener("error", this.onSocketError);
    } catch (error) {
      this.scheduleReconnect("connect_error", error);
    }
  }

  private detachSocketListeners(): void {
    if (!this.socket) {
      return;
    }
    this.socket.removeEventListener("open", this.onSocketOpen);
    this.socket.removeEventListener("message", this.onSocketMessage);
    this.socket.removeEventListener("close", this.onSocketClose);
    this.socket.removeEventListener("error", this.onSocketError);
    this.socket = null;
  }

  private scheduleReconnect(reason: string, error?: unknown): void {
    if (!this.started || this.reconnectTimer) {
      return;
    }

    this.detachSocketListeners();
    this.reconnectAttempts += 1;
    this.stats.reconnects += 1;
    const delayMs = computeReconnectDelay(this.reconnectAttempts, this.reconnectBaseMs, this.reconnectMaxMs);
    this.logger.warn("ingest.firehose.reconnect_scheduled", {
      reason,
      attempt: this.reconnectAttempts,
      delayMs,
      detail: error instanceof Error ? error.message : error ? String(error) : null,
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delayMs);
  }

  private replaceSnapshot(markets: RawPolymarketMarket[], source: "rest_bootstrap" | "websocket"): void {
    this.marketsById.clear();
    for (const market of markets) {
      const id = asStringId(market.id ?? market.marketId);
      if (!id) {
        continue;
      }
      this.marketsById.set(id, {
        ...market,
        id: market.id ?? id,
      });
    }
    this.markUpdated(source);
  }

  private markUpdated(source: "rest_bootstrap" | "websocket"): void {
    this.source = source;
    this.updatedAtMs = this.now();
  }

  private applyMarketUpdate(update: MarketChannelUpdate): boolean {
    const current = this.marketsById.get(update.marketId);
    if (!current) {
      this.stats.unknownMarketUpdates += 1;
      return false;
    }

    const next: RawPolymarketMarket = {
      ...current,
      updatedAt: toIsoDate(this.now()),
    };

    if (update.lastTradePrice !== null) {
      next.lastTradePrice = update.lastTradePrice;
      next.price = update.lastTradePrice;
    }
    if (update.bestBid !== null) {
      next.bestBid = update.bestBid;
    }
    if (update.bestAsk !== null) {
      next.bestAsk = update.bestAsk;
    }

    this.marketsById.set(update.marketId, next);
    this.stats.updatesApplied += 1;
    return true;
  }
}
