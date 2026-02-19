# Cloudflare Secrets Checklist

Use this list before enabling automated deploys.

## GitHub repository secrets
1. `CLOUDFLARE_API_TOKEN`
   - Create token in Cloudflare with minimum scopes:
     - `Account.Workers Scripts:Edit`
     - `Account.D1:Edit`
     - `Zone.DNS:Edit` (only if you automate DNS)
2. `CLOUDFLARE_ACCOUNT_ID`
   - Copy from Cloudflare dashboard account page.

## Local developer machine
1. `npx wrangler login`
2. `npx wrangler whoami`
3. Optional non-interactive auth:
   - set `CLOUDFLARE_API_TOKEN`
   - set `CLOUDFLARE_ACCOUNT_ID`
4. Protect admin refresh route (recommended):
   - set staging secret:
     - `echo "<token>" | npx wrangler secret put COASENSUS_ADMIN_REFRESH_TOKEN --config infra/cloudflare/wrangler.api.jsonc --env staging`
   - set production secret:
     - `echo "<token>" | npx wrangler secret put COASENSUS_ADMIN_REFRESH_TOKEN --config infra/cloudflare/wrangler.api.jsonc --env production`
   - call refresh with header:
     - `curl -X POST -H "X-Admin-Token: <token>" https://coasensus.com/api/admin/refresh-feed`

## Safety checks
1. Never commit `.dev.vars` or secret plaintext files.
2. Keep `database_id` values in config, but keep API keys only in secrets.
3. Rotate API token after sharing access or suspected leakage.
4. Rotate `COASENSUS_ADMIN_REFRESH_TOKEN` if exposed in logs/chat.
