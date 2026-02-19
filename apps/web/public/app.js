const state = {
  page: 1,
  pageSize: 20,
  sort: "score",
  category: "",
  includeRejected: false,
  totalPages: 1,
};

const API_BASE = window.COASENSUS_API_BASE || "http://localhost:8787";
const SESSION_KEY = "coasensus_session_id";
let trackedInitialView = false;

const el = {
  feed: document.getElementById("feed"),
  status: document.getElementById("status"),
  meta: document.getElementById("meta"),
  pageInfo: document.getElementById("pageInfo"),
  sort: document.getElementById("sort"),
  category: document.getElementById("category"),
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

function track(event, details = {}) {
  const payload = {
    event,
    source: "web",
    sessionId,
    pageUrl: window.location.href,
    details,
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

function fmtDate(value) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toLocaleDateString();
}

function titleCaseCategory(category) {
  return String(category || "other")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
    `Page size: ${meta.pageSize}`,
  ];
  el.meta.innerHTML = chips.map((item) => `<span class="chip">${item}</span>`).join("");
}

function renderCards(items) {
  if (!items.length) {
    el.feed.innerHTML = `<article class="card"><h3>No markets match this filter.</h3></article>`;
    return;
  }

  el.feed.innerHTML = items
    .map((item) => {
      const rankScore = (item.score?.civicScore || 0) + (item.score?.newsworthinessScore || 0);
      const badgeClass = item.isCurated ? "badge" : "badge rejected";
      const badgeText = item.isCurated ? titleCaseCategory(item.score?.category) : "Rejected";

      return `
        <article class="card">
          <div class="top">
            <span class="${badgeClass}">${badgeText}</span>
            <span class="chip">Score ${rankScore}</span>
          </div>
          <h3>${item.question}</h3>
          <div class="stats">
            <span><strong>Volume:</strong> ${fmtNum(item.volume)}</span>
            <span><strong>Liquidity:</strong> ${fmtNum(item.liquidity)}</span>
            <span><strong>Open interest:</strong> ${fmtNum(item.openInterest)}</span>
            <span><strong>Ends:</strong> ${fmtDate(item.endDate)}</span>
          </div>
          <div class="stats">
            <span><strong>Decision:</strong> ${item.decisionReason}</span>
          </div>
          <div class="actions">
            <a
              class="market-link"
              data-market-id="${item.id}"
              data-market-question="${encodeURIComponent(item.question)}"
              data-market-category="${item.score?.category || "other"}"
              href="${item.url}"
              target="_blank"
              rel="noreferrer"
            >Open on Polymarket</a>
          </div>
        </article>
      `;
    })
    .join("");
}

function setStatus(message) {
  el.status.textContent = message;
}

function syncControls() {
  el.sort.value = state.sort;
  el.category.value = state.category;
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

el.includeRejected.addEventListener("change", () => {
  state.page = 1;
  state.includeRejected = el.includeRejected.checked;
  track("include_rejected_toggled", { includeRejected: state.includeRejected });
  void loadFeed();
});

el.refresh.addEventListener("click", () => {
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
    question: decodeURIComponent(link.dataset.marketQuestion || ""),
  });
});

void loadFeed();
