# Web App

Local frontend for the Coasensus feed/cards experience.

## Commands
1. Start feed API in terminal A:
   - `npm run dev:feed-api`
2. Start web app in terminal B:
   - `npm run dev:web`
3. Open:
   - `http://localhost:3000`

## Runtime behavior
1. In local mode (`localhost`), app calls `http://localhost:8787/feed` by default.
2. In non-local environments, app defaults to same-origin API at `/api/feed`.
3. On `*.coasensus-web.pages.dev`, the app auto-targets the matching `workers.dev` API endpoint.
4. Use controls to search by market text, sort, filter by category, and include rejected markets.
5. The UI is mobile/desktop responsive and card-based.
6. Basic analytics events are sent to `/analytics` on the selected API base.
