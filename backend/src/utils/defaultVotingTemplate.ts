export const DEFAULT_VOTING_TEMPLATE = {
  id: 'default-voting',
  name: 'Voting Starter Kit',
  description:
    'Starter voting template that includes awards and election flows, OTP verification, paid intents, and leaderboard.',
  type: 'VOTING',
  isDefault: true,
  htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{event.name}} Voting</title>
</head>
<body>
  <main class="vote-shell">
    <section class="hero">
      <p class="eyebrow">Live Voting</p>
      <h1>{{event.name}}</h1>
      <p class="subtitle">Vote for nominees, track rankings, and complete paid vote checkout when enabled.</p>
      <div class="chip-row">
        <span class="chip" id="modeChip">Mode: {{voting.config.mode}}</span>
        <span class="chip" id="freeChip">Free: {{voting.config.allowFreeVotes}}</span>
        <span class="chip" id="paidChip">Paid: {{voting.config.allowPaidVotes}}</span>
      </div>
      <a class="small-link" href="{{urls.voting}}">Open canonical voting route</a>
      <a class="small-link" id="nominateLink" href="{{urls.nominate}}" hidden>Nominate someone</a>
    </section>

    <section class="card" id="otpPanel" hidden>
      <h2>Election OTP Verification</h2>
      <p class="hint">Required for election mode when OTP enforcement is enabled.</p>
      <div class="otp-grid">
        <label>
          <span>Phone Number</span>
          <input id="otpPhone" type="tel" placeholder="+233..." autocomplete="tel">
        </label>
        <button type="button" id="otpRequestBtn">Request OTP</button>
      </div>
      <div class="otp-grid">
        <label>
          <span>Code</span>
          <input id="otpCode" type="text" maxlength="8" placeholder="123456" inputmode="numeric">
        </label>
        <button type="button" id="otpVerifyBtn">Verify OTP</button>
      </div>
      <p class="hint" id="otpStatus">Status: Not verified</p>
    </section>

    <section class="card">
      <h2>Contest And Nominee</h2>
      <label>
        <span>Contest</span>
        <select id="contestSelect"></select>
      </label>
      <div id="nomineeList" class="nominee-list"></div>
    </section>

    <section class="card">
      <h2>Vote Actions</h2>
      <div class="action-grid">
        <button type="button" id="freeVoteBtn" class="btn-secondary">Cast Free Vote</button>
        <button type="button" id="refreshBtn" class="btn-muted">Refresh Leaderboard</button>
      </div>

      <div id="paidPanel" class="paid-panel" hidden>
        <h3>Paid Vote</h3>
        <div class="paid-grid">
          <label>
            <span>Vote Count</span>
            <input id="voteCountInput" type="number" min="1" step="1" value="1">
          </label>
          <label>
            <span>Gateway</span>
            <select id="gatewaySelect"></select>
          </label>
        </div>
        <p class="price" id="priceLine"></p>
        <button type="button" id="payVoteBtn" class="btn-primary">Pay And Vote</button>
      </div>

      <p id="statusLine" class="hint">Ready.</p>
    </section>

    <section class="card">
      <h2>Leaderboard</h2>
      <label>
        <span>Filter Contest</span>
        <select id="leaderboardContestSelect"></select>
      </label>
      <div id="leaderboardList" class="leaderboard-list"></div>
    </section>
  </main>
</body>
</html>`,
  cssContent: `
:root {
  --bg-top: #eef9f0;
  --bg-bottom: #d9ecdf;
  --card-bg: #ffffff;
  --border: #d8e7dd;
  --text: #103729;
  --muted: #4e7162;
  --brand: #0f6b4f;
  --brand-strong: #0b4f3b;
  --soft: #edf4f0;
  --danger: #9b1c1c;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: "Inter", "Segoe UI", sans-serif;
  color: var(--text);
  background: linear-gradient(180deg, var(--bg-top), var(--bg-bottom));
}

.vote-shell {
  max-width: 760px;
  margin: 0 auto;
  padding: 20px 14px 40px;
  display: grid;
  gap: 12px;
}

.hero,
.card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 14px;
}

.hero h1 {
  margin: 0;
  font-size: clamp(1.6rem, 4.5vw, 2.2rem);
  line-height: 1.2;
}

.eyebrow {
  margin: 0 0 6px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.72rem;
  color: var(--muted);
  font-weight: 700;
}

.subtitle {
  margin: 10px 0 0;
  color: var(--muted);
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.chip {
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--soft);
  padding: 5px 10px;
  font-size: 0.78rem;
  color: var(--muted);
}

.small-link {
  margin-top: 10px;
  display: inline-block;
  font-size: 0.8rem;
  color: var(--brand);
  text-decoration: none;
}

h2 {
  margin: 0 0 10px;
  font-size: 1.05rem;
}

h3 {
  margin: 0 0 8px;
  font-size: 0.95rem;
}

label {
  display: grid;
  gap: 6px;
}

label span {
  font-size: 0.78rem;
  color: var(--muted);
}

select,
input,
button {
  font: inherit;
}

select,
input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 11px;
  padding: 10px 11px;
  color: var(--text);
  background: #fff;
}

button {
  cursor: pointer;
  border: none;
  border-radius: 11px;
  padding: 10px 12px;
  font-weight: 600;
}

.action-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.btn-primary {
  background: var(--brand);
  color: #fff;
}

.btn-primary:hover {
  background: var(--brand-strong);
}

.btn-secondary {
  background: var(--soft);
  color: var(--text);
}

.btn-muted {
  background: #f8fbf9;
  color: var(--muted);
  border: 1px solid var(--border);
}

.hint {
  margin: 8px 0 0;
  font-size: 0.78rem;
  color: var(--muted);
}

.hint.error {
  color: var(--danger);
}

.nominee-list {
  margin-top: 10px;
  display: grid;
  gap: 8px;
}

.nominee-item {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 9px 10px;
  background: #fff;
  text-align: left;
}

.nominee-item.active {
  border-color: var(--brand);
  background: #ecf7f1;
}

.nominee-title {
  margin: 0;
  font-weight: 700;
}

.nominee-meta {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 0.8rem;
}

.paid-panel {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--border);
}

.paid-grid,
.otp-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: 1fr auto;
  margin-bottom: 8px;
}

.price {
  margin: 6px 0 10px;
  font-weight: 700;
}

.leaderboard-list {
  margin-top: 10px;
  display: grid;
  gap: 10px;
}

.leaderboard-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px;
  background: #fff;
}

.leaderboard-card h4 {
  margin: 0 0 8px;
  font-size: 0.92rem;
}

.leader-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.leader-row:last-child {
  margin-bottom: 0;
}

.leader-name {
  font-size: 0.84rem;
  color: var(--text);
}

.leader-value {
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--brand-strong);
}

@media (max-width: 540px) {
  .action-grid {
    grid-template-columns: 1fr;
  }

  .paid-grid,
  .otp-grid {
    grid-template-columns: 1fr;
  }
}
  `,
  jsContent: `
(function () {
  const FALLBACK = {
    config: {{voting.config}},
    contests: {{voting.contests}},
    leaderboard: {{voting.leaderboard}},
  };
  const API_BASE_FROM_TEMPLATE = "{{api.baseUrl}}".trim();
  const EVENT_SLUG = "{{event.slug}}".trim() || inferSlugFromPath();
  const API_BASE = resolveApiBase(API_BASE_FROM_TEMPLATE);
  const API_PREFIX = API_BASE.replace(/\\/+$/, "") + "/api";
  const EMBED_TOKEN = new URLSearchParams(window.location.search).get("embedToken")
    || new URLSearchParams(window.location.search).get("token")
    || "";
  const SESSION_STORAGE_KEY = "vote_session_token:" + EVENT_SLUG;

  const state = {
    config: FALLBACK.config || null,
    contests: Array.isArray(FALLBACK.contests) ? FALLBACK.contests : [],
    leaderboard: Array.isArray(FALLBACK.leaderboard) ? FALLBACK.leaderboard : [],
    paymentGateways: [],
    selectedContestId: "",
    selectedOptionId: "",
    sessionToken: localStorage.getItem(SESSION_STORAGE_KEY) || "",
    otpVerified: false,
    loading: false,
  };

  const elements = {
    modeChip: document.getElementById("modeChip"),
    freeChip: document.getElementById("freeChip"),
    paidChip: document.getElementById("paidChip"),
    otpPanel: document.getElementById("otpPanel"),
    otpStatus: document.getElementById("otpStatus"),
    otpPhone: document.getElementById("otpPhone"),
    otpCode: document.getElementById("otpCode"),
    otpRequestBtn: document.getElementById("otpRequestBtn"),
    otpVerifyBtn: document.getElementById("otpVerifyBtn"),
    contestSelect: document.getElementById("contestSelect"),
    nomineeList: document.getElementById("nomineeList"),
    freeVoteBtn: document.getElementById("freeVoteBtn"),
    refreshBtn: document.getElementById("refreshBtn"),
    paidPanel: document.getElementById("paidPanel"),
    voteCountInput: document.getElementById("voteCountInput"),
    gatewaySelect: document.getElementById("gatewaySelect"),
    payVoteBtn: document.getElementById("payVoteBtn"),
    priceLine: document.getElementById("priceLine"),
    statusLine: document.getElementById("statusLine"),
    leaderboardContestSelect: document.getElementById("leaderboardContestSelect"),
    leaderboardList: document.getElementById("leaderboardList"),
  };

  function inferSlugFromPath() {
    const match = window.location.pathname.match(/\\/e\\/([^/]+)\\/vote/i);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function resolveApiBase(templateValue) {
    if (templateValue) return templateValue;
    if (typeof window !== "undefined" && window.__EVENTPEEPO_API_BASE__) {
      return String(window.__EVENTPEEPO_API_BASE__);
    }
    return window.location.origin;
  }

  function setStatus(message, type) {
    if (!elements.statusLine) return;
    elements.statusLine.textContent = message || "";
    elements.statusLine.classList.toggle("error", type === "error");
  }

  function contestById(contestId) {
    return state.contests.find(function (contest) {
      return contest.id === contestId;
    }) || null;
  }

  function selectedContest() {
    return contestById(state.selectedContestId);
  }

  function selectedOption() {
    const contest = selectedContest();
    if (!contest) return null;
    return contest.options.find(function (option) {
      return option.id === state.selectedOptionId;
    }) || null;
  }

  function electionMode() {
    const contest = selectedContest();
    const mode = contest ? contest.mode : (state.config ? state.config.mode : "AWARDS");
    return mode === "ELECTION";
  }

  function otpRequired() {
    return electionMode() && Boolean(state.config && state.config.requireOtpForElection);
  }

  function currentVoteCount() {
    const raw = Number(elements.voteCountInput && elements.voteCountInput.value);
    const max = Number(state.config && state.config.maxVotesPerPurchase) || 100;
    if (!Number.isFinite(raw) || raw < 1) return 1;
    if (raw > max) return max;
    return Math.floor(raw);
  }

  function formatMoney(currency, amount) {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(amount);
    } catch (error) {
      return (currency || "USD") + " " + Number(amount || 0).toFixed(2);
    }
  }

  function renderHeader() {
    if (elements.modeChip) {
      elements.modeChip.textContent = "Mode: " + (state.config ? state.config.mode : "UNKNOWN");
    }
    if (elements.freeChip) {
      elements.freeChip.textContent = "Free: " + (state.config && state.config.allowFreeVotes ? "Enabled" : "Disabled");
    }
    if (elements.paidChip) {
      elements.paidChip.textContent = "Paid: " + (state.config && state.config.allowPaidVotes ? "Enabled" : "Disabled");
    }
    const nominateLink = document.getElementById("nominateLink");
    if (nominateLink) {
      nominateLink.hidden = !(state.config && state.config.allowPublicNominations);
    }
  }

  function renderContestSelect() {
    if (!elements.contestSelect) return;
    const options = state.contests.map(function (contest) {
      const label = contest.title + " (" + contest.mode + ")";
      return '<option value="' + escapeHtml(contest.id) + '">' + escapeHtml(label) + "</option>";
    }).join("");
    elements.contestSelect.innerHTML = options;

    if (!state.selectedContestId && state.contests.length > 0) {
      state.selectedContestId = state.contests[0].id;
    }
    elements.contestSelect.value = state.selectedContestId || "";
    syncSelectedOption();
  }

  function syncSelectedOption() {
    const contest = selectedContest();
    if (!contest || !Array.isArray(contest.options) || contest.options.length === 0) {
      state.selectedOptionId = "";
      return;
    }
    const stillValid = contest.options.some(function (option) {
      return option.id === state.selectedOptionId;
    });
    if (!stillValid) {
      state.selectedOptionId = contest.options[0].id;
    }
  }

  function renderNominees() {
    if (!elements.nomineeList) return;
    const contest = selectedContest();
    if (!contest || !contest.options || contest.options.length === 0) {
      elements.nomineeList.innerHTML = '<p class="hint">No nominees available.</p>';
      return;
    }

    const html = contest.options.map(function (option) {
      const activeClass = option.id === state.selectedOptionId ? " nominee-item active" : " nominee-item";
      const description = option.description || "Nominee";
      const votes = "Votes: " + Number(option.totalVotes || 0);
      return '<button type="button" data-option-id="' + escapeHtml(option.id) + '" class="' + activeClass.trim() + '">' +
        '<p class="nominee-title">' + escapeHtml(option.name) + '</p>' +
        '<p class="nominee-meta">' + escapeHtml(description) + "</p>" +
        '<p class="nominee-meta">' + escapeHtml(votes) + "</p>" +
      "</button>";
    }).join("");

    elements.nomineeList.innerHTML = html;

    const buttons = elements.nomineeList.querySelectorAll("button[data-option-id]");
    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        const nextId = button.getAttribute("data-option-id") || "";
        state.selectedOptionId = nextId;
        renderNominees();
      });
    });
  }

  function renderPaidPanel() {
    const showPaidPanel = Boolean(state.config && state.config.allowPaidVotes);
    if (elements.paidPanel) {
      elements.paidPanel.hidden = !showPaidPanel;
    }

    if (!showPaidPanel || !elements.gatewaySelect) return;

    const gatewayOptions = state.paymentGateways.map(function (gateway) {
      const label = gateway.name + " (" + String(gateway.gateway || "").toUpperCase() + ")";
      return '<option value="' + escapeHtml(gateway.id) + '">' + escapeHtml(label) + "</option>";
    }).join("");
    elements.gatewaySelect.innerHTML = gatewayOptions;

    if (!elements.gatewaySelect.value && state.paymentGateways.length > 0) {
      elements.gatewaySelect.value = state.paymentGateways[0].id;
    }

    renderPrice();
  }

  function renderPrice() {
    if (!elements.priceLine || !state.config) return;
    const count = currentVoteCount();
    const total = Number(state.config.voteUnitPrice || 0) * count;
    elements.priceLine.textContent = "Amount: " + formatMoney(state.config.currency || "USD", total);
  }

  function renderOtpPanel() {
    const showOtpPanel = otpRequired();
    if (elements.otpPanel) {
      elements.otpPanel.hidden = !showOtpPanel;
    }
    if (elements.otpStatus) {
      elements.otpStatus.textContent = "Status: " + (state.otpVerified ? "Verified" : "Not verified");
    }
  }

  function renderLeaderboardFilter() {
    if (!elements.leaderboardContestSelect) return;
    const options = ['<option value="">All contests</option>'].concat(
      state.contests.map(function (contest) {
        return '<option value="' + escapeHtml(contest.id) + '">' + escapeHtml(contest.title) + "</option>";
      })
    );
    elements.leaderboardContestSelect.innerHTML = options.join("");
  }

  function renderLeaderboard() {
    if (!elements.leaderboardList) return;

    if (!Array.isArray(state.leaderboard) || state.leaderboard.length === 0) {
      elements.leaderboardList.innerHTML = '<p class="hint">No leaderboard data yet.</p>';
      return;
    }

    const selectedFilter = elements.leaderboardContestSelect
      ? elements.leaderboardContestSelect.value
      : "";

    const filtered = state.leaderboard.filter(function (contest) {
      if (!selectedFilter) return true;
      return contest.contestId === selectedFilter;
    });

    if (filtered.length === 0) {
      elements.leaderboardList.innerHTML = '<p class="hint">No leaderboard entries for this contest.</p>';
      return;
    }

    elements.leaderboardList.innerHTML = filtered.map(function (contest) {
      const rows = (contest.rankings || []).slice(0, 8).map(function (entry) {
        const trend = Number(entry.trendDelta || 0);
        const trendText = trend === 0 ? "" : trend > 0 ? " (+" + trend + ")" : " (" + trend + ")";
        return '<div class="leader-row">' +
          '<span class="leader-name">#' + Number(entry.rank || 0) + " " + escapeHtml(entry.name || "Nominee") + "</span>" +
          '<span class="leader-value">' + Number(entry.totalVotes || 0) + trendText + "</span>" +
        "</div>";
      }).join("");

      return '<article class="leaderboard-card">' +
        "<h4>" + escapeHtml(contest.title || "Contest") + "</h4>" +
        rows +
      "</article>";
    }).join("");
  }

  function renderAll() {
    renderHeader();
    renderContestSelect();
    renderNominees();
    renderPaidPanel();
    renderOtpPanel();
    renderLeaderboardFilter();
    renderLeaderboard();
  }

  function setSessionToken(token) {
    state.sessionToken = token || "";
    if (!EVENT_SLUG) return;
    if (token) {
      localStorage.setItem(SESSION_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  async function apiRequest(path, options) {
    const requestOptions = options || {};
    const headers = Object.assign(
      { "Content-Type": "application/json" },
      requestOptions.headers || {}
    );
    const response = await fetch(API_PREFIX + path, {
      method: requestOptions.method || "GET",
      headers: headers,
      body: requestOptions.body,
    });
    const payload = await response.json().catch(function () {
      return {};
    });
    if (!response.ok) {
      throw new Error(
        payload.error || payload.message || "Request failed (" + response.status + ")"
      );
    }
    return payload;
  }

  async function loadVotingData() {
    if (!EVENT_SLUG) {
      setStatus("Event slug was not resolved.", "error");
      return;
    }

    state.loading = true;
    setStatus("Loading voting data...");
    try {
      const params = new URLSearchParams();
      if (state.sessionToken) params.set("sessionToken", state.sessionToken);
      if (EMBED_TOKEN) params.set("embedToken", EMBED_TOKEN);
      const query = params.toString() ? "?" + params.toString() : "";

      const publicData = await apiRequest("/voting/public/" + encodeURIComponent(EVENT_SLUG) + query);
      const leaderboardData = await apiRequest("/voting/public/" + encodeURIComponent(EVENT_SLUG) + "/leaderboard");

      state.config = publicData.config || state.config;
      state.contests = Array.isArray(publicData.contests) ? publicData.contests : [];
      state.paymentGateways = Array.isArray(publicData.paymentGateways) ? publicData.paymentGateways : [];
      state.otpVerified = Boolean(publicData.voterSession && publicData.voterSession.otpVerified);
      if (publicData.voterSession && publicData.voterSession.token) {
        setSessionToken(publicData.voterSession.token);
      }

      state.leaderboard = Array.isArray(leaderboardData.contests) ? leaderboardData.contests : [];
      if (!state.selectedContestId && state.contests.length > 0) {
        state.selectedContestId = state.contests[0].id;
      }
      syncSelectedOption();
      renderAll();
      setStatus("Voting data updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(message, "error");
    } finally {
      state.loading = false;
    }
  }

  async function submitFreeVote() {
    if (!state.config || !state.config.allowFreeVotes) {
      setStatus("Free voting is disabled for this event.", "error");
      return;
    }
    if (otpRequired() && !state.otpVerified) {
      setStatus("OTP verification is required before voting.", "error");
      return;
    }
    const contest = selectedContest();
    const option = selectedOption();
    if (!contest || !option) {
      setStatus("Select a contest and nominee first.", "error");
      return;
    }

    setStatus("Submitting free vote...");
    try {
      const payload = await apiRequest("/voting/free-vote", {
        method: "POST",
        body: JSON.stringify({
          slug: EVENT_SLUG,
          contestId: contest.id,
          optionId: option.id,
          sessionToken: state.sessionToken || undefined,
          embedToken: EMBED_TOKEN || undefined,
        }),
      });
      if (payload.voterSessionToken) {
        setSessionToken(payload.voterSessionToken);
      }
      setStatus(payload.message || "Free vote submitted.");
      await loadVotingData();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(message, "error");
    }
  }

  async function submitPaidVote() {
    if (!state.config || !state.config.allowPaidVotes) {
      setStatus("Paid voting is disabled for this event.", "error");
      return;
    }
    if (otpRequired() && !state.otpVerified) {
      setStatus("OTP verification is required before paid voting.", "error");
      return;
    }
    const contest = selectedContest();
    const option = selectedOption();
    if (!contest || !option) {
      setStatus("Select a contest and nominee first.", "error");
      return;
    }
    const gatewayId = elements.gatewaySelect ? elements.gatewaySelect.value : "";
    if (!gatewayId) {
      setStatus("Select a payment gateway.", "error");
      return;
    }
    const voteCount = currentVoteCount();
    if (elements.voteCountInput) {
      elements.voteCountInput.value = String(voteCount);
    }
    renderPrice();

    setStatus("Creating payment intent...");
    try {
      const payload = await apiRequest("/voting/payment-intent", {
        method: "POST",
        body: JSON.stringify({
          slug: EVENT_SLUG,
          contestId: contest.id,
          optionId: option.id,
          voteCount: voteCount,
          paymentGatewayId: gatewayId,
          sessionToken: state.sessionToken || undefined,
          embedToken: EMBED_TOKEN || undefined,
        }),
      });
      if (payload.voterSessionToken) {
        setSessionToken(payload.voterSessionToken);
      }
      const nextAction = payload.nextAction || null;
      if (nextAction && nextAction.type === "REDIRECT" && nextAction.url) {
        window.location.href = String(nextAction.url);
        return;
      }
      setStatus("Payment intent created. Complete payment in your gateway.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(message, "error");
    }
  }

  async function requestOtp() {
    const phone = elements.otpPhone ? elements.otpPhone.value.trim() : "";
    if (!phone) {
      setStatus("Enter a phone number before requesting OTP.", "error");
      return;
    }
    setStatus("Requesting OTP...");
    try {
      const payload = await apiRequest("/voting/otp/request", {
        method: "POST",
        body: JSON.stringify({
          slug: EVENT_SLUG,
          phone: phone,
          sessionToken: state.sessionToken || undefined,
          embedToken: EMBED_TOKEN || undefined,
        }),
      });
      if (payload.voterSessionToken) {
        setSessionToken(payload.voterSessionToken);
      }
      setStatus("OTP sent to " + (payload.maskedPhone || "phone") + ".");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(message, "error");
    }
  }

  async function verifyOtp() {
    const code = elements.otpCode ? elements.otpCode.value.trim() : "";
    if (!code) {
      setStatus("Enter the OTP code.", "error");
      return;
    }
    setStatus("Verifying OTP...");
    try {
      const payload = await apiRequest("/voting/otp/verify", {
        method: "POST",
        body: JSON.stringify({
          slug: EVENT_SLUG,
          code: code,
          sessionToken: state.sessionToken || undefined,
          embedToken: EMBED_TOKEN || undefined,
        }),
      });
      if (payload.voterSessionToken) {
        setSessionToken(payload.voterSessionToken);
      }
      state.otpVerified = Boolean(payload.verified);
      renderOtpPanel();
      setStatus("OTP verification complete.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(message, "error");
    }
  }

  async function refreshLeaderboardOnly() {
    if (!EVENT_SLUG) return;
    setStatus("Refreshing leaderboard...");
    try {
      const contestId = elements.leaderboardContestSelect ? elements.leaderboardContestSelect.value : "";
      const query = contestId ? "?contestId=" + encodeURIComponent(contestId) : "";
      const payload = await apiRequest("/voting/public/" + encodeURIComponent(EVENT_SLUG) + "/leaderboard" + query);
      state.leaderboard = Array.isArray(payload.contests) ? payload.contests : [];
      renderLeaderboard();
      setStatus("Leaderboard refreshed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(message, "error");
    }
  }

  function bindEvents() {
    if (elements.contestSelect) {
      elements.contestSelect.addEventListener("change", function () {
        state.selectedContestId = elements.contestSelect.value;
        syncSelectedOption();
        state.otpVerified = false;
        renderNominees();
        renderOtpPanel();
      });
    }

    if (elements.voteCountInput) {
      elements.voteCountInput.addEventListener("change", renderPrice);
      elements.voteCountInput.addEventListener("input", renderPrice);
    }

    if (elements.leaderboardContestSelect) {
      elements.leaderboardContestSelect.addEventListener("change", renderLeaderboard);
    }

    if (elements.freeVoteBtn) {
      elements.freeVoteBtn.addEventListener("click", function () {
        void submitFreeVote();
      });
    }

    if (elements.payVoteBtn) {
      elements.payVoteBtn.addEventListener("click", function () {
        void submitPaidVote();
      });
    }

    if (elements.refreshBtn) {
      elements.refreshBtn.addEventListener("click", function () {
        void refreshLeaderboardOnly();
      });
    }

    if (elements.otpRequestBtn) {
      elements.otpRequestBtn.addEventListener("click", function () {
        void requestOtp();
      });
    }

    if (elements.otpVerifyBtn) {
      elements.otpVerifyBtn.addEventListener("click", function () {
        void verifyOtp();
      });
    }
  }

  function escapeHtml(input) {
    return String(input || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  bindEvents();
  renderAll();
  void loadVotingData();
})();
  `,
};
