# DNS Required For Pages Custom Domains

If Pages domains show `pending` with `CNAME record not set`, create these Cloudflare DNS records in the `coasensus.com` zone.

## Required records
1. Name: `coasensus.com`
   - Type: `CNAME`
   - Target: `coasensus-web.pages.dev`
   - Proxy: `Proxied`
2. Name: `staging.coasensus.com`
   - Type: `CNAME`
   - Target: `coasensus-web.pages.dev`
   - Proxy: `Proxied`

## Why needed
1. Pages custom-domain validation waits for these CNAMEs.
2. Without them:
   - root site can return `522`
   - staging host can fail DNS resolution
   - status remains `pending`

## Verify after adding
1. Pages domain status should change to `active`.
2. Check:
   - `https://coasensus.com`
   - `https://staging.coasensus.com`
   - `https://coasensus.com/api/health`
   - `https://staging.coasensus.com/api/health`
