import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { loadAndBuildFeedWithMode, normalizeFeedQuery } from "./feed-store.js";

function json(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
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

async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.end();
    return;
  }

  if (req.method !== "GET") {
    json(res, 405, { error: "Only GET supported" });
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

  json(res, 404, {
    error: "Not found",
    routes: ["/health", "/feed?page=1&pageSize=20&sort=score"],
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
