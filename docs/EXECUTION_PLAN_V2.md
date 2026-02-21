# Hybrid Architecture Execution Plan for Coasensus

Context: The current Coasensus backend fetches all active Polymarket markets and uses a deterministic filter engine to classify and rank them. While functional, it lacks semantic understanding and struggles with high volumes of markets, especially the growing number of "meme" markets and low-liquidity markets. The plan below proposes a hybrid architecture consisting of:

Algorithmic Pre-Filter ("Bouncer") that filters markets purely on objective criteria (volume, liquidity, time bounds) using Polymarket's API parameters and reduces the number of markets passed to the LLM;

LLM-based semantic filter ("Editor-in-Chief") that evaluates each remaining market, determines whether it is a meme vs. newsworthy, assigns a newsworthiness score and category, and returns a structured JSON record using LLM JSON-mode or function calling to guarantee formatting; and

Mathematical ranking algorithm that combines the LLM's newsworthiness score with financial metrics (log-transformed volume/liquidity) and a time decay to produce the front page ranking.

The plan references existing repository structures (e.g., ingest-worker, filter-engine) and external documentation to guide design decisions.

## 1. Algorithmic Bouncer (Pre-Filtering)

### 1.1 Purpose

Reduce cost & latency: The Polymarket catalogue contains hundreds or thousands of markets, many of which are trivial or very low-interest. Passing them all to an LLM would be slow and expensive. A deterministic filter should drop markets that fail obvious thresholds.

Use Polymarket API filters: The Polymarket Gamma API exposes numeric filters like liquidity_num_min/max and volume_num_min/max and date range filters (start_date_min/max, end_date_min/max)[1]. These allow efficient pre-filtering server-side.

### 1.2 Criteria

Volume and Liquidity thresholds - Only consider markets whose total traded volume (volume_num) and available liquidity (liquidity_num) exceed configurable minimums. For example, set volume_num_min = 10000 and liquidity_num_min = 5000 during initial testing. These thresholds eliminate tiny markets and focus on markets with real financial interest.

Time bounds - Exclude markets that are about to close or have been open for too long:

Stale markets: If a market has not traded for a configurable window (e.g., no trades in the last week), drop it. This can be approximated using end_date_min / end_date_max or by comparing start_date with the current date and applying a maximum lifetime.

Expiring soon: If a market's end_date is within the next 1-2 hours, remove it from the front page. These markets are no longer "news"-they are nearly resolved.

Hard exclusions - Optionally apply deterministic exclusions similar to those in FILTER_ALGORITHM.md: drop markets with banned tags (crypto memes, trivial celebrity wagers) or markets flagged by Polymarket (e.g., closed: true).

### 1.3 Implementation Steps

Augment the ingestion worker: The current ingest-worker/src/index.ts fetches active markets using fetchActiveMarkets. Add a new pre-filter client in a Python or TypeScript service that queries the Polymarket Gamma API via its listMarkets endpoint. Use query parameters such as:

```ts
const params = {
  closed: false,
  liquidity_num_min: MIN_LIQUIDITY,
  volume_num_min: MIN_VOLUME,
  start_date_min: ISOStringForEarliestAcceptableDate,
  end_date_min: ISOStringForNowPlusBuffer,
  limit: PAGE_SIZE,
  offset: page * PAGE_SIZE,
};
```

The Gamma API documentation confirms that these parameters are supported and that numeric metrics like volume and liquidity are returned as numbers[2].

2. Parallelize requests: For large result sets, paginate the API with `limit` and `offset`. Concurrently fetch pages until no further markets meet the criteria.

3. Normalize and persist: Normalize the returned markets to your `Market` type. Store them in a temporary list or database (e.g., SQLite) along with raw financial metrics. At this stage each market should include at least `id`, `title/question`, `description`, `resolution_rules`, `volume_num`, `liquidity_num`, `start_date`, and `end_date`.

4. Configuration: Expose threshold values via environment variables or config so they can be tuned without code changes. Add metrics to monitor how many markets are dropped at this phase.

## 2. LLM "Editor-in-Chief" (Semantic Filtering)

### 2.1 Purpose

Semantic understanding: Some markets may have sufficient volume but still be trivial or memes. An LLM can read the market's title, description, and resolution rules to determine whether it is newsworthy.

Categorization and scoring: The LLM should assign a newsworthiness score (1-100), categorize the market into a high-level section (Politics, Tech/AI, Sports, Entertainment, etc.), determine a geographic tag (US, EU, Asia, etc.), and identify whether the market is a meme. These structured outputs will be used in ranking and UI tabs.

### 2.2 Structured Output Strategy

Use JSON mode or function-calling: LLM providers like OpenAI and Google Gemini support a JSON mode. In JSON mode the model returns valid JSON with no extra text[3], greatly reducing the need for fragile post-processing. Alternatively, define a function with parameters corresponding to your schema and let the model call it.

Define a schema: Use Pydantic or Zod to define the expected fields (e.g., is_meme: bool, newsworthiness_score: int (1-100), category: str, geo_tag: str, confidence: float). Convert the schema to a JSON Schema and include it in the system prompt or API call; JSON schema enforcement ensures consistent keys and types[4].

### 2.3 Prompt Design

System prompt: Set the model's role: "You are the Editor-in-Chief of a predictive news platform. Evaluate the following prediction market and return a valid JSON object matching the provided schema. Do not include any additional commentary."

User prompt: Include the market's title, description, and resolution_rules. Provide explicit instructions on classification. For example:

{ "title": "Will the S&P 500 close above 5,000 on March 28, 2026?", "description": "This market predicts whether the S&P 500 index will close above 5,000 on the specified date.", "resolution_rules": "The market resolves to 'Yes' if the official closing price of the S&P 500 on 2026-03-28 is > 5,000.", "guidelines": "Flag 'is_meme' as true for markets based on internet culture, trivial celebrity actions (e.g., new TikTok dance), or supernatural events (e.g., Jesus returning). Flag 'is_meme' as false for high-impact civic events, prestigious entertainment awards (Oscars, Game of the Year), major technology releases, or major sports championships. Assign a 'newsworthiness_score' from 1 to 100 based on global or cultural impact. Categorize the market into one of the allowed categories: Politics, Economy, Tech/AI, Sports, Entertainment, Other. Assign a continent (US, EU, Asia, Africa, MiddleEast, World) based on geographic relevance. Return a JSON object only." }

Few-shot examples: Provide a couple of example markets and their desired JSON outputs to steer the model. This can improve reliability in non-function-calling models.

### 2.4 Implementation Steps

Select a model: Use a cost-effective yet performant model such as Gemini 2.5 Flash or GPT-4o. Confirm support for JSON output; Google's Gemini models allow specifying response_mime_type: "application/json"[5].

Implement the LLM service: Write a Python service (e.g., services/llm-editor) that accepts a batch of markets from the pre-filter and calls the chosen model. The service should:

Send requests in batches to optimize throughput and cost. Group markets until the prompt size approaches the model's token limit.

Parse the JSON response and validate it against the schema. If validation fails, retry with a simpler prompt or log for manual review.

Attach the LLM output to each market record (e.g., is_meme, newsworthiness_score, category, geo_tag, confidence).

Store and monitor: Persist the enriched market objects in a database or file system. Record metrics (cost per call, classification results, failure rate). Consider caching results for markets whose metadata has not changed.

Iterative improvement: Periodically review a sample of LLM-classified markets to calibrate scoring and category definitions. Adjust prompts or the schema as necessary.

## 3. Front Page Ranking Algorithm

### 3.1 Purpose

Balance editorial quality and market interest: Use the LLM's newsworthiness score to surface high-impact stories while still considering financial signals (volume and liquidity) and keeping the feed fresh.

### 3.2 Scoring Formula

Proposed formula:

$$
\text{Front Page Score} = (w_1 \times S_{\text{LLM}}) + (w_2 \times \log(V+1)) + (w_3 \times \log(L+1)) - (\lambda \times \Delta t)
$$

**Where**
- S_LLM = newsworthiness score from the LLM (1-100).
- V = total trading volume (volume_num), log-scaled so that multi-million-dollar markets don't drown out smaller but important ones. Use natural or base-10 log.
- L = current market liquidity (liquidity_num), also log-scaled.
- delta_t = time decay term (e.g., hours since market creation or until market close). This term ensures freshness; older markets gradually decline in ranking.
- w1, w2, w3, lambda = tunable weights. Start by normalising S_LLM to 0-1 and calibrate weights so that editorial quality has slightly higher impact than volume.

Inspiration: GetStream's ranking examples combine time decay with popularity metrics; a linear decay multiplied by the square root of popularity reduces the effect of extremely popular items[6]. A "viral" formula uses a Gaussian decay and the logarithm of likes and comments[7]. Our formula similarly uses log transformations and a decay penalty.

### 3.3 Implementation Steps

Score computation: For each market returned from the LLM stage, compute log(volume_num + 1) and log(liquidity_num + 1). Compute delta_t as either the time since the market was created or the time remaining until resolution. Normalise S_LLM to a 0-1 range by dividing by 100.

Weight tuning: Store weights (w1, w2, w3, lambda) in a configuration file. Start with values such as w1 = 0.6, w2 = 0.25, w3 = 0.1, lambda = 0.02 and adjust based on observed rankings. Provide an admin interface or configuration file to adjust these weights without redeploying code.

Ranking service: Write a ranking function (e.g., computeFrontPageScore) in the backend (TypeScript or Python) that returns a numeric score for each market. Sort all markets by this score in descending order. Compute rankings both globally (for the front page) and per category (Politics & Policy, Tech & Science, Culture & Entertainment, Sports) to populate UI tabs.

Top-N selection: For the front page, select the top 10 markets by score. For each category tab, select the top 10 per category. Optionally implement a diversity constraint to avoid over-representation of any single category.

Recompute periodically: The ranking should be recalculated at regular intervals (e.g., every 30 minutes) to account for volume changes and decaying scores. Use a scheduled job or event-driven pipeline.

## 4. Database and Data Model

### 4.1 Schema Enhancements

Add the following fields to the existing `Market` or `CuratedFeedItem` type (modifying the shared interface and relevant database tables):
- `volume_num` (number): total traded volume (already available via Polymarket API)
- `liquidity_num` (number): current liquidity
- `newsworthiness_score` (integer 1-100): from LLM
- `is_meme` (boolean)
- `category` (enum): `politics`, `economy`, `policy`, `tech_ai`, `entertainment`, `sports`, `other`
- `geo_tag` (enum): `US`, `EU`, `Asia`, `Africa`, `MiddleEast`, `World`
- `llm_confidence` (optional float): if available from LLM
- `front_page_score` (float): computed by ranking formula
- `created_at`, `updated_at` timestamps

### 4.2 Storage Strategy

Normalized markets: Continue storing the raw normalized markets (as done in latest/normalized.json or SQLite). Pre-filter and LLM outputs should be appended as separate columns rather than overwriting raw fields.

Curated feed table: Create a dedicated table or JSON file for the curated feed containing both raw data and LLM/ranking fields. This table can be used to serve the front end directly.

Indices: Index on category, geo_tag, and front_page_score to allow efficient querying and sorting.

## 5. UI & Newspaper Structure

Based on the earlier proposals, structure the user interface as follows:

Front Page - Display the top N (e.g., 10) markets across all categories sorted by front_page_score. Highlight the category and region on each card.

Politics & Policy - Markets where category is politics, economy, or policy and is_meme is false. Optionally include subfilters for elections, legislation, and macroeconomics.

Tech & Science - Markets where category is tech_ai or science. Include AI model releases, major tech product launches, and scientific breakthroughs.

Culture & Entertainment - Markets where category is entertainment. Gate this section carefully: include award shows (Oscars, Game of the Year), major movie releases, but exclude trivial YouTube drama. Only include is_meme = false markets.

Sports - Markets covering major sports leagues or events. Use the LLM's category and geographic tag to route to sub-sections (e.g., US vs. EU sports).

World - A catch-all tab with sub-tags by continent (geo_tag). Use the LLM output to label each market's geographic relevance.

Search & Filters - Provide search and filter controls (by market name, date range, category, region). These operate on the enriched dataset.

### 5.1 Predictive Masonry Grid

The feed should not resemble a trading terminal; it needs to feel like a curated newspaper that readers can quickly scan. A masonry-style grid (similar to Google Keep) works well because markets vary in description length. Implement this using standard CSS columns (column-count and column-gap) so that:

Desktop: Show three or four columns; the grid naturally staggers cards of different heights. A responsive layout collapses to a single column on narrow screens.

Mobile: The feed collapses into a single scrolling column, mirroring a social feed. At the bottom of each tab, animate a page-turn effect to transition to the next section (e.g., front page → politics → tech), preserving the feeling of a finite newspaper.

### 5.2 News Card Anatomy

Each card should look like a news briefing rather than a betting slip. Consider including the following elements:

Headline (LLM-Generated): Polymarket titles are phrased as questions ("Will SpaceX launch …?"). When calling the LLM you can add one line to rewrite the question into a declarative headline (e.g., "SpaceX eyes March launch for Starship"). If cost is a concern, you can use the original title directly.

Future State (Probability): Display the current prediction as a percentage rather than a price. Make this the largest element on the card (e.g., "74 % chance"). Colour-code the percentage (e.g., green for > 75 %, yellow/grey for ~50 %) so users can scan probabilities quickly.

Context Hook (LLM-Generated): Ask the LLM to provide a one- or two-sentence summary explaining why this prediction matters or providing context. Keep it concise and neutral.

Deadline: Show the market's resolution date (e.g., "Resolves by Nov 4 2024"), letting readers know the timeframe.

Skin in the Game: Display the total volume or liquidity (e.g., "$1.2 M wagered") to convey the amount of money behind the prediction. Use log-scaled numbers if needed to avoid overwhelming the layout.

### 5.3 Visual & UX Enhancements

Images & Icons: The Polymarket API often provides an icon URL for each market. These small images (politician photos, flags, logos) can be placed in the corner of the card at no extra cost. Alternatively, assign a minimalist icon or emoji based on the LLM-determined category (e.g., 🏈 for sports, 🎬 for entertainment). If images are disabled for cost reasons, rely on colour-coded typography.

Trending Shift Arrow: Because the system refreshes every 45 minutes, you can compute the change in probability relative to the previous day. Display an up/down arrow next to the percentage (e.g., "↑ 5 % today") to make the feed feel alive. Hide this feature if the overhead of storing historical probabilities becomes prohibitive.

Hero Card: The highest-scoring market on the front page can be featured more prominently by spanning two columns or using a larger card. This emphasises the top story, similar to a front-page headline in a traditional newspaper.

Editorial Grouping: Use the LLM's category and region tags to build distinct tabs such as Front Page | Tech & AI | Geopolitics | Pop Culture etc. The masonry grid resets when switching tabs, and the page-turn animation reinforces the sense of moving through sections of a newspaper.

These design guidelines are suggestions and can evolve as the front-end is developed in parallel with the backend. Provide configuration flags (e.g., enable/disable images, hero card) so that the visual complexity can be adjusted without backend changes.

## 6. Orchestration & Pipeline

Refresh Cycle & Ingestion - Align the pipeline with a 45-minute refresh interval. At minute 0, fetch all active markets via the Polymarket API using the pre-filter parameters (volume, liquidity, time bounds). At minute 1, for each fetched market:

Cache lookup: Check a database (or persistent cache) for the market ID. If the market already exists, update its probability/volume/liquidity metrics using fresh data and skip the LLM call.

New markets: If the market is not found in the cache, send its text to the LLM service (Phase 2) to obtain the JSON output. Persist the JSON metadata alongside the raw market and mark it as evaluated so the LLM is never asked about this market again. Caching LLM outputs drastically reduces cost because the model only evaluates newly created markets.

Semantic Filtering Worker - Implement the LLM service as described in Section 2. It should support batch calls, JSON mode, and schema validation. When invoked as part of the refresh cycle, it only processes markets absent from the cache. Persist the enriched records.

Ranking Job - At minute 2 of each cycle, recompute the front_page_score for every active market using the updated financial metrics (volume/liquidity) and cached LLM scores. Sort and cache results for API consumption. This ensures the front page reflects up-to-date trading activity without incurring additional LLM cost.

API Layer - Provide endpoints (GraphQL or REST) to serve the curated feed to the front end:

GET /frontPage - returns the top N markets with their metadata;

GET /markets?category=...&region=... - returns markets filtered by category or region;

GET /market/:id - returns details of a single market.

Optionally, GET /trending - returns markets with the largest probability change since the previous refresh.

Caching vs. Brute-Force Scenarios - Primary Scenario A uses a database to cache LLM outputs and update only financial metrics on each refresh. This keeps costs near zero and improves load times. A fallback Scenario B (for prototyping or if a database is unavailable) pushes all markets to the LLM at each refresh. Scenario B is significantly more expensive and is not recommended for production.

Admin Dashboard & Controls - Provide tools to adjust thresholds, weights, and categories; view classification logs; purge or refresh the cache; and manually override LLM errors. Administrators should also be able to toggle features like trending arrows or hero cards.

Monitoring & Logging - Instrument each stage with metrics: number of markets ingested, number of new markets sent to the LLM, LLM call cost, cache hit/miss ratio, classification distributions, and ranking outcomes. Expose dashboards and set alerts for anomalies or API failures.

## 7. Technology Considerations & Best Practices

API Utilization: The Polymarket Gamma API supports filtering by liquidity_num_min and volume_num_min and returns numeric metrics[2]. Use these server-side filters rather than retrieving all markets. Validate date parameters to avoid errors.

Structured Outputs: Use JSON mode or function-calling when available[3]. When using Gemini, set response_mime_type to application/json[5]. Validate the LLM response against a JSON schema to prevent downstream crashes.

Ranking: Use log transformations and time decay to moderate the influence of very popular markets. This approach is inspired by feed-ranking examples that combine decay functions with popularity metrics[8].

Iterative Development: Start with conservative thresholds and weights; collect feedback and adjust. Monitor classification outcomes to ensure the LLM isn't over-filtering or mis-tagging high-impact markets.

Cost Management & Refresh Cadence: Batch LLM calls and choose token-efficient models, but only evaluate new markets. Implement a caching layer so that the LLM's structured output is stored once per market ID and reused on subsequent refreshes. Coupling this cache with a 45-minute refresh cadence ensures you update financial metrics frequently without re-invoking the LLM. Discard or down-rank is_meme = true markets early to reduce wasted compute. Maintain a fallback strategy (brute-force evaluation without caching) only during development when a database is unavailable.

## 8. Milestones & Next Steps

Status sync note (February 21, 2026): this checklist has been updated to match shipped repository state and deployed milestones.

Setup & Configuration

- [x] Define configuration parameters: volume/liquidity thresholds, date filters, LLM model & API keys, ranking weights.
- [x] Create or update database tables to store enriched market metadata.
- [x] Design and provision a caching layer (e.g., SQLite, Postgres, or Redis) to store LLM outputs keyed by market ID. Ensure the cache includes fields for market ID, newsworthiness score, category, geo tag, is_meme flag, and timestamp of last update.
Pre-filter Implementation

- [x] Implement a client to call Polymarket's listMarkets with numeric filters[2].
- [x] Integrate the pre-filter into the ingestion worker; persist results.
- [x] Write unit tests to ensure markets below thresholds are dropped.
LLM Service

- [x] Define the JSON schema for the LLM output using Pydantic or Zod.
- [x] Implement the LLM calling service with batch support, JSON mode, and schema validation.
- [x] Add fallback logic for invalid outputs and metrics logging.
- [x] Implement caching logic: before invoking the LLM, check if a market's ID exists in the cache. If present, skip the LLM call and update only financial metrics; otherwise, call the LLM and cache the result.
Ranking Algorithm

- [x] Implement the front-page scoring function using the proposed formula.
- [x] Add configuration for weights and decay parameter; provide default values.
- [ ] Write tests to verify ranking ordering and evaluate edge cases.
- [x] Add a method to compute trending shifts (percentage change since last refresh) and integrate it into ranking or optional UI elements.
UI & API Integration

- [x] Modify the existing feed-store to consume enriched market data and use front_page_score instead of the legacy civic/newsworthiness sum.
- [x] Update API endpoints and front-end components to display categories and regions.
- [x] Implement search and filter controls in the UI.
- [ ] Build the masonry grid layout using CSS columns. Ensure it is responsive (3-4 columns on desktop; single column on mobile) and supports a page-turn animation at the end of each tab.
- [ ] Develop the news card component with headline, probability, context hook, deadline, and volume fields. Add support for optional images/icons and colour-coded probabilities.
- [ ] Implement optional UX features: trending shift arrows, hero card spanning multiple columns, category icons/emojis.
- [ ] Expose configuration flags on the backend to enable or disable these features without redeploying the front end.
Monitoring & Evaluation

- [x] Instrument metrics (pre-filter drop count, LLM classification distribution, ranking outcomes).
- [ ] Deploy dashboards and alerts.
- [ ] Conduct manual reviews of random samples to refine prompts and weights.
- [ ] Monitor cache hit/miss ratios and LLM call frequency to ensure cost savings from caching. Set alerts if the cache is bypassed unexpectedly.
Continuous Improvement

- [ ] Iterate on prompt design, thresholds, and weights based on user feedback and data.
- [ ] Explore ML classification models or fine-tuned LLMs if scaling with general models becomes costly.
- [ ] Expand categories or region tags as global user interest grows.
This execution plan lays out how to extend Coasensus into a scalable, hybrid system that combines deterministic filtering, LLM-powered semantic understanding, and mathematically grounded ranking. By limiting the number of markets passed to the LLM and enforcing structured outputs, the system balances cost and accuracy while delivering a curated, newsworthy front page.

[1] [2] Markets - Polymarket Data SDK
https://polymarket-data.com/gamma/markets

[3] [4] [5] The guide to structured outputs and function calling with LLMs
https://agenta.ai/blog/the-guide-to-structured-outputs-and-function-calling-with-llms

[6] [7] [8] Example Ranking Methods for Your Feeds
https://getstream.io/blog/getting-started-ranked-feeds-getstream-io/

