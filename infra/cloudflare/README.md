# Cloudflare Deploy

This folder is the deploy scaffold for Coasensus on Cloudflare.

## Architecture
1. `Pages` serves `apps/web/public` on:
   - `https://coasensus.com` (production)
   - `https://staging.coasensus.com` (staging)
2. `Workers` serves API routes under `/api/*`:
   - `GET /api/health`
   - `GET /api/feed`
   - `POST /api/analytics`
   - `GET /api/analytics`
3. `D1` stores curated feed + analytics + ingestion records.

## Files
1. `wrangler.api.jsonc`: API Worker config with `staging` + `production` env blocks.
2. `wrangler.pages.jsonc`: Pages config for static web app deployment.
3. `workers/feed-api/src/index.ts`: Worker API entrypoint.
4. `ENVIRONMENT_MATRIX.md`: staging/production mapping.
5. `SECRETS_CHECKLIST.md`: secret setup and safety checklist.

## One-time setup checklist
1. Install/upgrade Wrangler:
   - `npm i -D wrangler`
2. Authenticate:
   - `npx wrangler login`
   - `npx wrangler whoami`
3. Create D1 databases:
   - `npx wrangler d1 create coasensus-staging`
   - `npx wrangler d1 create coasensus-production`
4. Replace placeholder `database_id` values in `wrangler.api.jsonc`.
5. Apply migrations:
   - `npx wrangler d1 migrations apply coasensus-staging --remote --config infra/cloudflare/wrangler.api.jsonc --env staging`
   - `npx wrangler d1 migrations apply coasensus-production --remote --config infra/cloudflare/wrangler.api.jsonc --env production`
6. Create Pages project:
   - `npx wrangler pages project create coasensus-web`

## Deploy commands
From repo root:

```bash
# API worker
npx wrangler deploy --config infra/cloudflare/wrangler.api.jsonc --env staging
npx wrangler deploy --config infra/cloudflare/wrangler.api.jsonc --env production

# Static web app
npx wrangler pages deploy apps/web/public --project-name coasensus-web --branch staging
npx wrangler pages deploy apps/web/public --project-name coasensus-web --branch main
```

## GitHub Actions integration
Workflow: `.github/workflows/deploy-cloudflare.yml`

Set repo secrets:
1. `CLOUDFLARE_API_TOKEN`
2. `CLOUDFLARE_ACCOUNT_ID`

Behavior:
1. Push to `main` deploys `production`.
2. Manual `workflow_dispatch` supports `staging` or `production`.

## DNS and domain notes (`coasensus.com`)
1. Pages custom domain:
   - `coasensus.com`
   - `www.coasensus.com` (optional redirect)
2. Worker route:
   - `coasensus.com/api/*` for production
   - `staging.coasensus.com/api/*` for staging
3. SSL:
   - Use Cloudflare-managed certificates (auto HTTPS).
