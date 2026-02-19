import { runIngestionOnce } from "./index.js";

function parseEnvInt(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main(): Promise<void> {
  const limitPerPage = parseEnvInt("POLYMARKET_LIMIT_PER_PAGE", 50);
  const maxPages = parseEnvInt("POLYMARKET_MAX_PAGES", 2);
  const retries = parseEnvInt("POLYMARKET_RETRIES", 2);
  const requestTimeoutMs = parseEnvInt("POLYMARKET_TIMEOUT_MS", 12000);

  const result = await runIngestionOnce({
    limitPerPage,
    maxPages,
    retries,
    requestTimeoutMs,
  });

  const preview = result.normalizedMarkets.slice(0, 5).map((market, index) => ({
    rank: index + 1,
    id: market.id,
    question: market.question,
    endDate: market.endDate,
    volume: market.volume,
    liquidity: market.liquidity,
  }));

  // Keep output concise and machine-readable for CI or manual local checks.
  console.log(
    JSON.stringify(
      {
        smoke: "ok",
        snapshot: result.snapshot,
        preview,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        smoke: "failed",
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exit(1);
});

