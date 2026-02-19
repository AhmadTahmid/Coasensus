import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC_DIR = path.resolve(fileURLToPath(new URL("../public", import.meta.url)));

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

function parsePort(): number {
  const raw = process.env.WEB_PORT;
  const parsed = Number(raw);
  if (!raw || !Number.isFinite(parsed) || parsed < 1) {
    return 3000;
  }
  return parsed;
}

function getFilePath(urlPath: string): string {
  if (urlPath === "/" || urlPath === "") {
    return path.join(PUBLIC_DIR, "index.html");
  }
  const cleaned = urlPath.replace(/^\/+/, "");
  return path.join(PUBLIC_DIR, cleaned);
}

async function canAccess(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

function boot(): void {
  const port = parsePort();
  const server = createServer(async (req, res) => {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.end("Method not allowed");
      return;
    }

    const url = new URL(req.url ?? "/", "http://localhost");
    let filePath = getFilePath(url.pathname);

    if (!(await canAccess(filePath))) {
      filePath = path.join(PUBLIC_DIR, "index.html");
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", contentTypeFor(filePath));
    createReadStream(filePath).pipe(res);
  });

  server.listen(port, () => {
    process.stdout.write(`[web] listening on http://localhost:${port}\n`);
  });
}

boot();

