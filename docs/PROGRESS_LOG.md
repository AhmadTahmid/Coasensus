# Progress Log

## 2026-02-19
1. Added execution strategy in `COASENSUS_EXECUTION_PLAN.md`.
2. Initialized monorepo folder layout.
3. Added beginner runbook and orchestration docs.
4. Added shared market type contracts.
5. Added agent prompts and commit policy.
6. Added execution issue checklist for parallel agents.
7. Added real foundation tooling: ESLint + Vitest + strict workspace typecheck.
8. Added ingest normalizer module with tests.
9. Added filter engine module with deterministic curation + tests.
10. Added live Polymarket API client with pagination, timeout, retries, and backoff.
11. Added ingestion run helper (`runIngestionOnce`) and local smoke script.
12. Validated live smoke run against Polymarket (`rawCount: 100`, `normalizedCount: 100`).
13. Added local persistence for raw + normalized + snapshot artifacts under `infra/db/local`.
14. Added local curated feed API (`/feed`) backed by latest persisted normalized data.
15. Added local web feed UI with responsive cards wired to `/feed`.
16. Added cross-origin support in feed API for local multi-port development.
17. Added SQLite persistence module for ingestion runs (`infra/db/coasensus.sqlite` default).
18. Added dual persistence mode in ingest flow (JSON + SQLite).
19. Added structured ingest smoke logs with timing metrics.
20. Added feed API storage mode switch (`json` or `sqlite`).
21. Added basic web analytics events + API ingestion (`POST /analytics`).
22. Added Cloudflare API Worker scaffold with D1-backed `/api/feed` + `/api/analytics` routes.
23. Added Cloudflare config files for staging/production (`wrangler.api.jsonc`, `wrangler.pages.jsonc`).
24. Added baseline D1 SQL migration at `infra/db/migrations/0001_initial_schema.sql`.
25. Added GitHub Actions Cloudflare deploy workflow (`deploy-cloudflare.yml`).
26. Added noob-friendly Cloudflare setup + secrets runbooks.
27. Updated Cloudflare API config with real D1 IDs for staging and production.
28. Applied staging D1 migration (`0001_initial_schema.sql`) remotely.
29. Deployed staging API Worker (`coasensus-api-staging`) with route `staging.coasensus.com/api/*`.
30. Created Cloudflare Pages project (`coasensus-web`) and deployed staging preview branch.
31. Applied production D1 migration (`0001_initial_schema.sql`) remotely.
32. Deployed production API Worker (`coasensus-api`) with route `coasensus.com/api/*`.
33. Deployed production Pages branch (`main`) to `coasensus-web.pages.dev`.
34. Attached Pages custom domains (`coasensus.com`, `staging.coasensus.com`) via Cloudflare API.
35. Captured DNS blocker: custom domains remain `pending` with `CNAME record not set`.
36. Added Pages preview API fallback in web app for `*.coasensus-web.pages.dev`.
37. Redeployed staging Pages branch with fallback update (`d4db533e`).
38. Redeployed production Pages branch with fallback update (`73b297ed`).
39. Confirmed API health checks return 200 on:
   - `https://coasensus.com/api/health`
   - `https://coasensus-api-staging.tahmidahmad1970.workers.dev/api/health`
40. Added deploy workflow DNS upsert automation and fixed push-event execution issues.
41. DNS CNAME validation moved from `pending` to `active` for:
   - `coasensus.com`
   - `staging.coasensus.com`
42. Verified custom-domain web + API health:
   - `https://coasensus.com` => `200`
   - `https://staging.coasensus.com` => `200`
   - `https://coasensus.com/api/health` => `200`
   - `https://staging.coasensus.com/api/health` => `200`
43. Diagnosed recurring CI deploy failure: worker step was using invalid Wrangler flag (`--log-level`) and exiting with help text.
44. Added temporary annotation-based diagnostics, removed invalid flag, and confirmed `Deploy Cloudflare` workflow is now green.
45. Added CI-specific Worker config (`wrangler.api.ci.jsonc`) to avoid route-management friction in automated deploy runs.
