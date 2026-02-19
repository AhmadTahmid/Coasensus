# Environment Matrix

## Staging
1. Web URL: `https://staging.coasensus.com`
2. API route: `https://staging.coasensus.com/api/*`
3. Worker env: `staging`
4. D1 database: `coasensus-staging`
5. Deploy command:
   - `npx wrangler deploy --config infra/cloudflare/wrangler.api.jsonc --env staging`

## Production
1. Web URL: `https://coasensus.com`
2. API route: `https://coasensus.com/api/*`
3. Worker env: `production`
4. D1 database: `coasensus-production`
5. Deploy command:
   - `npx wrangler deploy --config infra/cloudflare/wrangler.api.jsonc --env production`
