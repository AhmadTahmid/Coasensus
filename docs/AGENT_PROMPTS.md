# Agent Prompts

## Agent 1: Platform/Foundation
```text
Set up a strict TypeScript monorepo foundation for Coasensus. Ensure shared types for Market and CuratedFeedItem exist and are used as stable contracts. Keep setup minimal and production-oriented.
```

## Agent 2: Ingestion
```text
Implement a Polymarket active-market ingestion service with retries, normalization into canonical schema, and persistence hooks. Add tests for normalization edge cases.
```

## Agent 3: Filter Engine
```text
Build a deterministic filtering/scoring engine to remove meme/noise markets and keep civic/newsworthy ones. Include explainable decision_reason output and unit tests.
```

## Agent 4: Web UI/API
```text
Build a responsive feed/card experience consuming curated markets API. Include sorting, category badges, pagination, loading state, and robust error state.
```

## Agent 5: Infra/Deploy
```text
Set up Cloudflare deployment for the app and prepare domain wiring for coasensus.com with HTTPS, env secret management, and deployment runbook.
```

## Agent 6: QA/Observability
```text
Add smoke tests and health checks for ingestion and feed freshness. Ensure failures are discoverable quickly with clear logs and alert-ready output.
```

