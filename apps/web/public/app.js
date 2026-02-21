const state = {
  page: 1,
  pageSize: 20,
  sort: "score",
  category: "",
  region: "",
  search: "",
  includeRejected: false,
  totalPages: 1,
};

function resolveApiBase() {
  if (typeof window.COASENSUS_API_BASE === "string" && window.COASENSUS_API_BASE.trim()) {
    return window.COASENSUS_API_BASE.trim();
  }

  const host = window.location.hostname;
  const isLocalhost = host === "localhost" || host === "127.0.0.1";
  if (isLocalhost) {
    return "http://localhost:8787";
  }

  if (host.endsWith(".coasensus-web.pages.dev")) {
    if (host.startsWith("staging.")) {
      return "https://coasensus-api-staging.tahmidahmad1970.workers.dev/api";
    }
    return "https://coasensus-api.tahmidahmad1970.workers.dev/api";
  }

  // Production defaults to same-origin API route handled by Cloudflare Worker.
  return `${window.location.origin}/api`;
}

const API_BASE = resolveApiBase();
const SESSION_KEY = "coasensus_session_id";
const ANALYTICS_STATE_KEY = "coasensus_analytics_state_v1";
const ANALYTICS_MAX_EVENTS_PER_SESSION = 160;
const DEFAULT_ANALYTICS_RULE = Object.freeze({
  sampleRate: 1,
  minIntervalMs: 0,
  maxPerSession: 40,
});
const ANALYTICS_RULES = Object.freeze({
  page_view: Object.freeze({
    sampleRate: 1,
    minIntervalMs: 0,
    maxPerSession: 1,
  }),
  feed_loaded: Object.freeze({
    sampleRate: 0.4,
    minIntervalMs: 60_000,
    maxPerSession: 24,
  }),
  search_changed: Object.freeze({
    sampleRate: 1,
    minIntervalMs: 1_200,
    maxPerSession: 40,
  }),
  sort_changed: Object.freeze({
    sampleRate: 1,
    minIntervalMs: 1_200,
    maxPerSession: 40,
  }),
  category_changed: Object.freeze({
    sampleRate: 1,
    minIntervalMs: 1_200,
    maxPerSession: 40,
  }),
  region_changed: Object.freeze({
    sampleRate: 1,
    minIntervalMs: 1_200,
    maxPerSession: 40,
  }),
  include_rejected_toggled: Object.freeze({
    sampleRate: 1,
    minIntervalMs: 1_200,
    maxPerSession: 20,
  }),
  refresh_clicked: Object.freeze({
    sampleRate: 1,
    minIntervalMs: 3_000,
    maxPerSession: 30,
  }),
  pagination_previous: Object.freeze({
    sampleRate: 0.5,
    minIntervalMs: 2_000,
    maxPerSession: 36,
  }),
  pagination_next: Object.freeze({
    sampleRate: 0.5,
    minIntervalMs: 2_000,
    maxPerSession: 36,
  }),
  market_clicked: Object.freeze({
    sampleRate: 1,
    minIntervalMs: 700,
    maxPerSession: 120,
  }),
});
let trackedInitialView = false;

const el = {
  feed: document.getElementById("feed"),
  status: document.getElementById("status"),
  meta: document.getElementById("meta"),
  pageInfo: document.getElementById("pageInfo"),
  search: document.getElementById("search"),
  sort: document.getElementById("sort"),
  category: document.getElementById("category"),
  region: document.getElementById("region"),
  includeRejected: document.getElementById("includeRejected"),
  refresh: document.getElementById("refresh"),
  prev: document.getElementById("prev"),
  next: document.getElementById("next"),
};

function getSessionId() {
  try {
    const cached = window.localStorage.getItem(SESSION_KEY);
    if (cached) return cached;
    const value =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
    window.localStorage.setItem(SESSION_KEY, value);
    return value;
  } catch {
    return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}

const sessionId = getSessionId();
let analyticsState = loadAnalyticsState();

function createEmptyAnalyticsState() {
  return {
    sessionId,
    totalSent: 0,
    events: {},
  };
}

function loadAnalyticsState() {
  const fallback = createEmptyAnalyticsState();
  try {
    const raw = window.localStorage.getItem(ANALYTICS_STATE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return fallback;
    }
    if (parsed.sessionId !== sessionId) {
      return fallback;
    }

    const totalSentRaw = Number(parsed.totalSent);
    const totalSent = Number.isFinite(totalSentRaw) && totalSentRaw > 0 ? Math.floor(totalSentRaw) : 0;
    const events = {};
    const parsedEvents =
      parsed.events && typeof parsed.events === "object" && !Array.isArray(parsed.events) ? parsed.events : {};

    for (const [eventName, stats] of Object.entries(parsedEvents)) {
      if (!eventName || !stats || typeof stats !== "object") {
        continue;
      }
      const sentRaw = Number(stats.sent);
      const lastSentAtRaw = Number(stats.lastSentAt);
      events[eventName] = {
        sent: Number.isFinite(sentRaw) && sentRaw > 0 ? Math.floor(sentRaw) : 0,
        lastSentAt: Number.isFinite(lastSentAtRaw) && lastSentAtRaw > 0 ? Math.floor(lastSentAtRaw) : 0,
      };
    }

    return {
      sessionId,
      totalSent,
      events,
    };
  } catch {
    return fallback;
  }
}

function persistAnalyticsState() {
  try {
    window.localStorage.setItem(ANALYTICS_STATE_KEY, JSON.stringify(analyticsState));
  } catch {
    // Ignore storage write failures (private mode/storage disabled).
  }
}

function normalizeDetails(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
}

function getAnalyticsRule(eventName) {
  return ANALYTICS_RULES[eventName] || DEFAULT_ANALYTICS_RULE;
}

function shouldSample(sampleRate) {
  if (sampleRate >= 1) return true;
  if (sampleRate <= 0) return false;
  return Math.random() < sampleRate;
}

function shouldTrackEvent(eventName) {
  const now = Date.now();
  const rule = getAnalyticsRule(eventName);
  const eventStats = analyticsState.events[eventName] || { sent: 0, lastSentAt: 0 };

  if (analyticsState.totalSent >= ANALYTICS_MAX_EVENTS_PER_SESSION) {
    return { allowed: false, rule };
  }
  if (eventStats.sent >= rule.maxPerSession) {
    return { allowed: false, rule };
  }
  if (rule.minIntervalMs > 0 && eventStats.lastSentAt > 0 && now - eventStats.lastSentAt < rule.minIntervalMs) {
    return { allowed: false, rule };
  }
  if (!shouldSample(rule.sampleRate)) {
    return { allowed: false, rule };
  }

  analyticsState.events[eventName] = {
    sent: eventStats.sent + 1,
    lastSentAt: now,
  };
  analyticsState.totalSent += 1;
  persistAnalyticsState();

  return { allowed: true, rule };
}

function track(event, details = {}) {
  const decision = shouldTrackEvent(event);
  if (!decision.allowed) {
    return;
  }

  const safeDetails = { ...normalizeDetails(details) };
  if (decision.rule.sampleRate < 1) {
    safeDetails.analyticsSampleRate = decision.rule.sampleRate;
  }

  const payload = {
    event,
    source: "web",
    sessionId,
    pageUrl: window.location.href,
    details: safeDetails,
  };

  const body = JSON.stringify(payload);
  const endpoint = `${API_BASE}/analytics`;

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon(endpoint, blob);
    return;
  }

  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Analytics is best-effort and should never block UI behavior.
  });
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function fmtNum(value) {
  const num = toNumber(value);
  return num === null ? "n/a" : num.toLocaleString();
}

function fmtScore(value) {
  const num = toNumber(value);
  if (num === null) return "n/a";
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
}

function fmtDate(value) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toLocaleDateString();
}

function normalizeProbability(value) {
  const num = toNumber(value);
  if (num === null) return null;
  if (num >= 0 && num <= 1) return num;
  if (num > 1 && num <= 100) return num / 100;
  return null;
}

function fmtProbabilityPrice(value) {
  const probability = normalizeProbability(value);
  if (probability === null) return "n/a";
  const percent = probability * 100;
  return `${percent.toFixed(1)}% (${percent.toFixed(1)}c)`;
}

function resolvePolymarketLink(rawUrl, marketId) {
  const fallback = `https://polymarket.com/market/${encodeURIComponent(marketId)}`;
  if (!rawUrl) return fallback;
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    if (host === "polymarket.com" || host.endsWith(".polymarket.com")) {
      parsed.protocol = "https:";
      return parsed.toString();
    }
  } catch {
    // Fall through to fallback below.
  }
  return fallback;
}

function formatTrendDelta(value) {
  const num = toNumber(value);
  if (num === null) return { label: "Trend n/a", className: "flat" };
  if (num > 0) return { label: `Trend ↑ +${num.toFixed(2)}`, className: "up" };
  if (num < 0) return { label: `Trend ↓ ${num.toFixed(2)}`, className: "down" };
  return { label: "Trend ↔ 0.00", className: "flat" };
}

function titleCaseCategory(category) {
  return String(category || "other")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatGeoTag(value) {
  const tag = String(value || "World");
  if (tag === "MiddleEast") return "Middle East";
  return tag;
}

function resolveFrontPageScore(item) {
  const frontPageScore = toNumber(item.frontPageScore);
  if (frontPageScore !== null) {
    return frontPageScore;
  }
  return (toNumber(item.score?.civicScore) || 0) + (toNumber(item.score?.newsworthinessScore) || 0);
}

function formatDecisionReason(reason) {
  if (!reason) return "n/a";
  return String(reason)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function truncateDescription(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (!text) return "";
  if (text.length <= 220) return text;
  return `${text.slice(0, 217)}...`;
}

function normalizeSearchQuery(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

function syncSearchStateFromInput() {
  const normalized = normalizeSearchQuery(el.search.value);
  el.search.value = normalized;
  state.search = normalized;
}

function feedUrl() {
  const params = new URLSearchParams({
    page: String(state.page),
    pageSize: String(state.pageSize),
    sort: state.sort,
  });

  if (state.category) {
    params.set("category", state.category);
  }
  if (state.region) {
    params.set("region", state.region);
  }
  if (state.search) {
    params.set("q", state.search);
  }
  if (state.includeRejected) {
    params.set("includeRejected", "1");
  }

  return `${API_BASE}/feed?${params.toString()}`;
}

function renderMeta(meta) {
  const chips = [
    `Total items: ${meta.totalItems}`,
    `Sort: ${meta.sort}`,
    `Category: ${meta.category || "all"}`,
    `Region: ${formatGeoTag(meta.region || "all")}`,
    `Search: ${meta.searchQuery || "none"}`,
    `Page size: ${meta.pageSize}`,
  ];
  el.meta.innerHTML = chips.map((item) => `<span class="chip">${item}</span>`).join("");
}

function renderCards(items) {
  const safeItems = Array.isArray(items) ? items : [];
  if (!safeItems.length) {
    el.feed.innerHTML = `<article class="card"><h3>No markets match this filter.</h3></article>`;
    return;
  }

  const [leadItem, ...remainingItems] = safeItems;

  const renderCard = (item, isLead = false) => {
    const badgeCategory = titleCaseCategory(item.score?.category);
    const badgeRegion = formatGeoTag(item.geoTag);
    const frontPageScore = fmtScore(resolveFrontPageScore(item));
    const trend = formatTrendDelta(item.trendDelta);
    const decision = formatDecisionReason(item.decisionReason);
    const deck = truncateDescription(item.description);
    const titleTag = isLead ? "h2" : "h3";
    const oddsPrice = fmtProbabilityPrice(item.probability);
    const marketLink = resolvePolymarketLink(item.url, item.id);

    return `
      <article class="card ${isLead ? "lead-card" : "story-card"}">
        <div class="top">
          <div class="badge-row">
            ${isLead ? `<span class="lead-kicker">Front Page Lead</span>` : ""}
            <span class="badge">${badgeCategory}</span>
            <span class="badge region-badge">${badgeRegion}</span>
            <span class="badge trend-badge ${trend.className}">${trend.label}</span>
            ${item.isCurated ? "" : `<span class="badge rejected">Rejected</span>`}
          </div>
          <span class="odds-pill"><strong>Odds / Price ${oddsPrice}</strong></span>
          <span class="score-pill">Front Page ${frontPageScore}</span>
        </div>
        <${titleTag}>${item.question}</${titleTag}>
        ${deck ? `<p class="deck">${deck}</p>` : ""}
        <div class="stats">
          <span><strong>Volume:</strong> ${fmtNum(item.volume)}</span>
          <span><strong>Liquidity:</strong> ${fmtNum(item.liquidity)}</span>
          <span><strong>Ends:</strong> ${fmtDate(item.endDate)}</span>
        </div>
        <p class="decision"><strong>Decision:</strong> ${decision}</p>
        <div class="actions">
          <a
            class="market-link"
            data-market-id="${item.id}"
            data-market-question="${encodeURIComponent(item.question)}"
            data-market-category="${item.score?.category || "other"}"
            data-market-region="${item.geoTag || "World"}"
            href="${marketLink}"
            target="_blank"
            rel="noreferrer"
          >Open on Polymarket</a>
        </div>
      </article>
    `;
  };

  const gridMarkup =
    remainingItems.length > 0
      ? `<div class="feed-grid">${remainingItems.map((item) => renderCard(item, false)).join("")}</div>`
      : "";

  el.feed.innerHTML = `${renderCard(leadItem, true)}${gridMarkup}`;
}

function setStatus(message) {
  el.status.textContent = message;
}

function syncControls() {
  el.search.value = state.search;
  el.sort.value = state.sort;
  el.category.value = state.category;
  el.region.value = state.region;
  el.includeRejected.checked = state.includeRejected;
  el.prev.disabled = state.page <= 1;
  el.next.disabled = state.page >= state.totalPages;
  el.pageInfo.textContent = `Page ${state.page} / ${state.totalPages}`;
}

async function loadFeed() {
  setStatus("Loading feed...");
  syncControls();

  try {
    const response = await fetch(feedUrl());
    if (!response.ok) {
      throw new Error(`Feed API responded ${response.status}`);
    }
    const data = await response.json();
    state.totalPages = Math.max(1, data.meta?.totalPages || 1);
    state.page = Math.min(state.page, state.totalPages);
    renderMeta(data.meta);
    renderCards(data.items || []);
    setStatus(`Updated at ${new Date().toLocaleTimeString()}`);
    syncControls();
    track("feed_loaded", {
      page: state.page,
      pageSize: state.pageSize,
      sort: state.sort,
      category: state.category || "all",
      region: state.region || "all",
      search: state.search || "none",
      includeRejected: state.includeRejected,
      totalItems: data.meta?.totalItems ?? 0,
      itemCount: Array.isArray(data.items) ? data.items.length : 0,
    });
    if (!trackedInitialView) {
      trackedInitialView = true;
      track("page_view", {
        path: window.location.pathname,
        query: window.location.search,
      });
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    setStatus(`Failed to load feed: ${detail}`);
    el.feed.innerHTML = `
      <article class="card">
        <h3>Feed unavailable</h3>
        <p>Make sure the feed API is running with <code>npm run dev:feed-api</code>.</p>
      </article>
    `;
  }
}

el.search.addEventListener("change", () => {
  state.page = 1;
  syncSearchStateFromInput();
  track("search_changed", { search: state.search || "none", source: "change" });
  void loadFeed();
});

el.search.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  state.page = 1;
  syncSearchStateFromInput();
  track("search_changed", { search: state.search || "none", source: "enter" });
  void loadFeed();
});

el.sort.addEventListener("change", () => {
  state.page = 1;
  state.sort = el.sort.value;
  track("sort_changed", { sort: state.sort });
  void loadFeed();
});

el.category.addEventListener("change", () => {
  state.page = 1;
  state.category = el.category.value;
  track("category_changed", { category: state.category || "all" });
  void loadFeed();
});

el.region.addEventListener("change", () => {
  state.page = 1;
  state.region = el.region.value;
  track("region_changed", { region: state.region || "all" });
  void loadFeed();
});

el.includeRejected.addEventListener("change", () => {
  state.page = 1;
  state.includeRejected = el.includeRejected.checked;
  track("include_rejected_toggled", { includeRejected: state.includeRejected });
  void loadFeed();
});

el.refresh.addEventListener("click", () => {
  syncSearchStateFromInput();
  track("refresh_clicked");
  void loadFeed();
});

el.prev.addEventListener("click", () => {
  if (state.page <= 1) return;
  state.page -= 1;
  track("pagination_previous", { page: state.page });
  void loadFeed();
});

el.next.addEventListener("click", () => {
  if (state.page >= state.totalPages) return;
  state.page += 1;
  track("pagination_next", { page: state.page });
  void loadFeed();
});

el.feed.addEventListener("click", (event) => {
  const link = event.target.closest("a.market-link");
  if (!link) return;
  track("market_clicked", {
    marketId: link.dataset.marketId || "",
    category: link.dataset.marketCategory || "other",
    region: link.dataset.marketRegion || "World",
    question: decodeURIComponent(link.dataset.marketQuestion || ""),
  });
});

void loadFeed();
