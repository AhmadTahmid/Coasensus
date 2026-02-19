import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { loadAndBuildFeedWithMode, normalizeFeedQuery } from "./feed-store.js";
import { listAnalyticsEventsSqlite, persistAnalyticsEventSqlite } from "./sqlite-storage.js";

function json(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function requestUrl(req: IncomingMessage): URL {
  const host = req.headers.host ?? "localhost:8787";
  const target = req.url ?? "/";
  return new URL(target, `http://${host}`);
}

function parsePort(): number {
  const raw = process.env.FEED_API_PORT;
  if (!raw) {
    return 8787;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8787;
}

function parseStorageMode(): "json" | "sqlite" {
  return process.env.FEED_STORAGE_MODE === "sqlite" ? "sqlite" : "json";
}

function parseAnalyticsDbPath(): string | undefined {
  return process.env.FEED_ANALYTICS_DB_PATH ?? process.env.INGEST_SQLITE_DB_PATH;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  const maxBytes = 64 * 1024;

  return new Promise((resolve, reject) => {
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      const total = chunks.reduce((sum, item) => sum + item.length, 0);
      if (total > maxBytes) {
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8").trim();
        resolve(raw.length > 0 ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.end();
    return;
  }

  const url = requestUrl(req);

  if (url.pathname === "/health") {
    json(res, 200, { status: "ok", service: "coasensus-feed-api" });
    return;
  }

  if (url.pathname === "/feed") {
    try {
      const query = normalizeFeedQuery(url.searchParams);
      const sourcePath = process.env.INGEST_LATEST_NORMALIZED_PATH;
      const sqliteDbPath = process.env.INGEST_SQLITE_DB_PATH;
      const feed = await loadAndBuildFeedWithMode(query, sourcePath, {
        storageMode: parseStorageMode(),
        sqliteDbPath,
      });
      json(res, 200, feed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      json(res, 503, {
        error: "Feed unavailable",
        detail: message,
        hint: "Run `npm run smoke:ingest` first to generate source data.",
      });
    }
    return;
  }

  if (url.pathname === "/analytics" && req.method === "POST") {
    try {
      const body = asRecord(await readJsonBody(req));
      const event = typeof body.event === "string" ? body.event.trim() : "";
      if (!event) {
        json(res, 400, { error: "event is required" });
        return;
      }

      const source = typeof body.source === "string" ? body.source : "web";
      const sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined;
      const pageUrl = typeof body.pageUrl === "string" ? body.pageUrl : undefined;
      const details = asRecord(body.details);

      const stored = await persistAnalyticsEventSqlite(
        {
          event,
          source,
          sessionId,
          pageUrl,
          details,
        },
        { dbPath: parseAnalyticsDbPath() }
      );

      json(res, 202, { ok: true, id: stored.id, ts: stored.ts });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      json(res, 400, { error: "Invalid analytics payload", detail: message });
    }
    return;
  }

  if (url.pathname === "/analytics" && req.method === "GET") {
    try {
      const rawLimit = Number(url.searchParams.get("limit") ?? "50");
      const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(200, Math.floor(rawLimit))) : 50;
      const events = await listAnalyticsEventsSqlite(limit, { dbPath: parseAnalyticsDbPath() });
      json(res, 200, { events, count: events.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      json(res, 500, { error: "Failed to read analytics events", detail: message });
    }
    return;
  }

  if (req.method !== "GET") {
    json(res, 405, { error: "Only GET/POST supported" });
    return;
  }

  json(res, 404, {
    error: "Not found",
    routes: ["/health", "/feed?page=1&pageSize=20&sort=score", "/analytics"],
  });
}

function main(): void {
  const port = parsePort();
  const server = createServer((req, res) => {
    void handler(req, res);
  });
  server.listen(port, () => {
    process.stdout.write(`[feed-api] listening on http://localhost:${port}\n`);
  });
}

main();
