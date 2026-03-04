export const DEFAULT_VOTING_NOMINATION_TEMPLATE = {
  id: 'default-voting-nomination',
  name: 'Voting Nomination Starter',
  description: 'Public nomination intake page with admin-defined categories and custom fields.',
  type: 'VOTING_NOMINATION',
  isDefault: true,
  htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{event.name}} · Nomination</title>
</head>
<body>
  <main class="nom-shell">
    <header class="nom-hero">
      <p class="eyebrow">Public Nomination</p>
      <h1>{{event.name}}</h1>
      <p class="sub">Nominate people by category. Every submission goes through admin review.</p>
      <nav class="hero-links">
        <a href="{{urls.nominees}}">Browse nominees</a>
        <a href="{{urls.vote}}">Go to voting</a>
        <a href="{{urls.leaderboard}}">View leaderboard</a>
      </nav>
    </header>

    <section class="nom-card">
      <h2>Submit Nomination</h2>
      <form id="nominationForm" novalidate>
        <label>
          <span>Category</span>
          <select id="contestId" required></select>
        </label>
        <label>
          <span>Nominee Name</span>
          <input id="nomineeName" type="text" required maxlength="160" placeholder="Enter full name" />
        </label>
        <label>
          <span>Nominee Description</span>
          <textarea id="nomineeDescription" rows="3" maxlength="1000" placeholder="Why should this nominee be considered?"></textarea>
        </label>

        <div class="split">
          <label>
            <span>Your Name</span>
            <input id="submitterName" type="text" required maxlength="160" placeholder="Your name" />
          </label>
          <label>
            <span>Your Email</span>
            <input id="submitterEmail" type="email" maxlength="180" placeholder="you@example.com" />
          </label>
        </div>

        <label>
          <span>Your Phone</span>
          <input id="submitterPhone" type="tel" maxlength="32" placeholder="+233..." />
        </label>

        <div id="customFields" class="custom-fields" hidden></div>

        <button id="submitBtn" type="submit">Submit Nomination</button>
      </form>
      <p id="status" class="status">Ready.</p>
    </section>
  </main>
</body>
</html>`,
  cssContent: `
:root {
  --bg: radial-gradient(circle at top right, #ffe7df, #f8fafb 42%, #eef3f5 100%);
  --card: #ffffff;
  --text: #161a1d;
  --muted: #58616b;
  --border: #e7eaee;
  --brand: #ff3b30;
  --brand-strong: #df2c22;
  --accent: #ff8f5a;
  --shadow: 0 20px 44px rgba(18, 30, 43, 0.08);
}
* { box-sizing: border-box; }
body { margin: 0; font-family: "Plus Jakarta Sans", "Inter", "Segoe UI", sans-serif; color: var(--text); background: var(--bg); }
.nom-shell { width: min(980px, 100% - 24px); margin: 24px auto 44px; display: grid; gap: 16px; }
.nom-hero, .nom-card { border: 1px solid var(--border); border-radius: 24px; background: var(--card); box-shadow: var(--shadow); }
.nom-hero { padding: 20px; background: linear-gradient(132deg, #111416 0%, #1f252a 48%, #2d3338 100%); color: #fff; }
.eyebrow { margin: 0; text-transform: uppercase; letter-spacing: .12em; font-size: .72rem; color: #ffd9c5; font-weight: 700; }
.nom-hero h1 { margin: 8px 0 0; font-size: clamp(1.7rem, 4.2vw, 2.6rem); }
.sub { margin: 8px 0 0; color: #dce3ea; }
.hero-links { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
.hero-links a { color: #fff; text-decoration: none; border: 1px solid rgba(255,255,255,.25); border-radius: 999px; padding: 7px 12px; font-size: .82rem; }
.hero-links a:hover { border-color: var(--accent); background: rgba(255,143,90,.12); }
.nom-card { padding: 18px; }
.nom-card h2 { margin: 0 0 12px; font-size: 1.15rem; }
form { display: grid; gap: 11px; }
label { display: grid; gap: 6px; }
label span { font-size: .78rem; color: var(--muted); font-weight: 600; }
input, select, textarea { width: 100%; border: 1px solid var(--border); border-radius: 12px; padding: 11px 12px; font: inherit; color: var(--text); background: #fff; }
input:focus, select:focus, textarea:focus { outline: 2px solid color-mix(in srgb, var(--brand) 28%, transparent); border-color: var(--brand); }
.split { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 11px; }
.custom-fields { margin-top: 2px; padding-top: 10px; border-top: 1px dashed var(--border); display: grid; gap: 10px; }
button[type="submit"] { border: none; border-radius: 12px; background: var(--brand); color: #fff; font-weight: 700; padding: 12px 14px; cursor: pointer; }
button[type="submit"]:hover { background: var(--brand-strong); }
button[type="submit"]:disabled { opacity: .6; cursor: not-allowed; }
.status { margin: 10px 0 0; color: var(--muted); font-size: .82rem; }
.status.error { color: #b42318; }
@media (max-width: 720px) { .split { grid-template-columns: 1fr; } }
`,
  jsContent: `
(function () {
  const FALLBACK_CONTESTS = Array.isArray({{voting.contests}}) ? {{voting.contests}} : [];
  const EVENT_SLUG = "{{event.slug}}";
  const API_BASE = ("{{api.baseUrl}}" || window.location.origin).replace(/\\/+$/, "") + "/api";
  const SESSION_KEY = "vote_session_token:" + EVENT_SLUG;

  const el = {
    form: document.getElementById("nominationForm"),
    contestId: document.getElementById("contestId"),
    nomineeName: document.getElementById("nomineeName"),
    nomineeDescription: document.getElementById("nomineeDescription"),
    submitterName: document.getElementById("submitterName"),
    submitterEmail: document.getElementById("submitterEmail"),
    submitterPhone: document.getElementById("submitterPhone"),
    customFields: document.getElementById("customFields"),
    submitBtn: document.getElementById("submitBtn"),
    status: document.getElementById("status"),
  };

  const state = {
    contests: FALLBACK_CONTESTS,
    sessionToken: localStorage.getItem(SESSION_KEY) || "",
  };

  function setStatus(message, isError) {
    if (!el.status) return;
    el.status.textContent = message;
    el.status.classList.toggle("error", Boolean(isError));
  }

  function activeContest() {
    const id = el.contestId ? el.contestId.value : "";
    return state.contests.find(function (contest) { return contest.id === id; }) || null;
  }

  function renderContestOptions() {
    if (!el.contestId) return;
    el.contestId.innerHTML = state.contests
      .filter(function (contest) { return contest && contest.allowPublicNominations; })
      .map(function (contest) {
        return '<option value="' + esc(contest.id) + '">' + esc(contest.title + ' (' + contest.mode + ')') + '</option>';
      })
      .join("");

    if (!el.contestId.value && el.contestId.options.length > 0) {
      el.contestId.value = el.contestId.options[0].value;
    }
    renderCustomFields();
  }

  function renderCustomFields() {
    if (!el.customFields) return;
    const contest = activeContest();
    const fields = contest && Array.isArray(contest.nominationFormFields) ? contest.nominationFormFields : [];
    if (!fields.length) {
      el.customFields.hidden = true;
      el.customFields.innerHTML = "";
      return;
    }
    el.customFields.hidden = false;
    el.customFields.innerHTML = fields.map(function (field) {
      const fid = 'cf_' + esc(field.id);
      const required = field.required ? ' required' : '';
      const placeholder = field.placeholder ? ' placeholder="' + esc(field.placeholder) + '"' : '';
      if (field.type === 'textarea') {
        return '<label><span>' + esc(field.label) + '</span><textarea data-field-id="' + esc(field.id) + '" id="' + fid + '" rows="3"' + required + placeholder + '></textarea></label>';
      }
      if (field.type === 'select') {
        const options = Array.isArray(field.options) ? field.options : [];
        return '<label><span>' + esc(field.label) + '</span><select data-field-id="' + esc(field.id) + '" id="' + fid + '"' + required + '><option value="">Select...</option>' + options.map(function (opt) { return '<option value="' + esc(opt) + '">' + esc(opt) + '</option>'; }).join('') + '</select></label>';
      }
      const inputType = field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text';
      return '<label><span>' + esc(field.label) + '</span><input data-field-id="' + esc(field.id) + '" id="' + fid + '" type="' + inputType + '"' + required + placeholder + ' /></label>';
    }).join('');
  }

  async function loadNominationForm() {
    try {
      const payload = await request('/voting/public/' + encodeURIComponent(EVENT_SLUG) + '/nomination-form');
      const contests = Array.isArray(payload.contests) ? payload.contests : [];
      state.contests = contests.length ? contests : state.contests;
      renderContestOptions();
      setStatus('Nomination form loaded.');
    } catch (error) {
      setStatus(error.message || 'Failed to load nomination form', true);
      renderContestOptions();
    }
  }

  async function submitNomination(event) {
    event.preventDefault();
    const contest = activeContest();
    if (!contest) {
      setStatus('Select a category first.', true);
      return;
    }
    const customFields = {};
    if (el.customFields) {
      el.customFields.querySelectorAll('[data-field-id]').forEach(function (node) {
        const key = node.getAttribute('data-field-id');
        if (!key) return;
        customFields[key] = node.value;
      });
    }

    const body = {
      contestId: contest.id,
      nomineeName: el.nomineeName ? el.nomineeName.value.trim() : '',
      nomineeDescription: el.nomineeDescription && el.nomineeDescription.value.trim() ? el.nomineeDescription.value.trim() : undefined,
      submitterName: el.submitterName ? el.submitterName.value.trim() : '',
      submitterEmail: el.submitterEmail && el.submitterEmail.value.trim() ? el.submitterEmail.value.trim() : undefined,
      submitterPhone: el.submitterPhone && el.submitterPhone.value.trim() ? el.submitterPhone.value.trim() : undefined,
      customFields: customFields,
      sessionToken: state.sessionToken || undefined,
    };

    if (!body.nomineeName || !body.submitterName) {
      setStatus('Nominee name and your name are required.', true);
      return;
    }

    if (el.submitBtn) el.submitBtn.disabled = true;
    setStatus('Submitting nomination...');

    try {
      const payload = await request('/voting/public/' + encodeURIComponent(EVENT_SLUG) + '/nominations', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (payload.voterSessionToken) {
        state.sessionToken = payload.voterSessionToken;
        localStorage.setItem(SESSION_KEY, payload.voterSessionToken);
      }
      if (el.form) el.form.reset();
      renderCustomFields();
      setStatus('Nomination submitted successfully. Awaiting admin review.');
    } catch (error) {
      setStatus(error.message || 'Failed to submit nomination', true);
    } finally {
      if (el.submitBtn) el.submitBtn.disabled = false;
    }
  }

  async function request(path, init) {
    const response = await fetch(API_BASE + path, {
      method: init && init.method ? init.method : 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json' }, init && init.headers ? init.headers : {}),
      body: init && init.body ? init.body : undefined,
    });
    const payload = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      throw new Error(payload.error || payload.message || ('Request failed (' + response.status + ')'));
    }
    return payload;
  }

  function esc(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  if (el.contestId) {
    el.contestId.addEventListener('change', renderCustomFields);
  }
  if (el.form) {
    el.form.addEventListener('submit', submitNomination);
  }

  renderContestOptions();
  void loadNominationForm();
})();
`,
};

export const DEFAULT_VOTING_NOMINEES_TEMPLATE = {
  id: 'default-voting-nominees',
  name: 'Voting Nominees Starter',
  description: 'Category-grouped nominee listing with direct vote CTAs.',
  type: 'VOTING_NOMINEES',
  isDefault: true,
  htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{event.name}} · Nominees</title>
</head>
<body>
  <main class="nominees-shell">
    <header class="nominees-hero">
      <p class="eyebrow">Nominees</p>
      <h1>{{event.name}}</h1>
      <p class="sub">Explore nominees by category and vote directly from each profile.</p>
      <nav class="hero-links">
        <a href="{{urls.nominate}}">Submit nomination</a>
        <a href="{{urls.vote}}">Go to voting</a>
        <a href="{{urls.leaderboard}}">Leaderboard</a>
      </nav>
    </header>

    <section class="nominees-card">
      <div class="toolbar">
        <h2>Nominees By Category</h2>
        <select id="categoryFilter"></select>
      </div>
      <div id="categoryGroups" class="category-groups"></div>
    </section>
  </main>
</body>
</html>`,
  cssContent: `
:root {
  --bg: radial-gradient(circle at top left, #fff0ea, #f8fafc 38%, #edf1f4 100%);
  --card: #fff;
  --text: #111827;
  --muted: #5a6572;
  --border: #e6e9ee;
  --brand: #ff3b30;
  --brand-strong: #db2d23;
  --gold: #c69b2f;
  --shadow: 0 18px 40px rgba(17, 24, 39, .08);
}
* { box-sizing: border-box; }
body { margin: 0; font-family: "Plus Jakarta Sans", "Inter", sans-serif; color: var(--text); background: var(--bg); }
.nominees-shell { width: min(1120px, 100% - 24px); margin: 24px auto 44px; display: grid; gap: 16px; }
.nominees-hero, .nominees-card { border: 1px solid var(--border); border-radius: 24px; box-shadow: var(--shadow); background: var(--card); }
.nominees-hero { padding: 20px; background: linear-gradient(130deg, #14181d 0%, #242a30 52%, #2f373f 100%); color: #fff; }
.eyebrow { margin: 0; text-transform: uppercase; letter-spacing: .11em; font-size: .72rem; font-weight: 700; color: #ffd6c3; }
.nominees-hero h1 { margin: 8px 0 0; font-size: clamp(1.8rem, 4.3vw, 2.8rem); }
.sub { margin: 8px 0 0; color: #dce5ee; }
.hero-links { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
.hero-links a { color: #fff; text-decoration: none; border: 1px solid rgba(255,255,255,.24); border-radius: 999px; padding: 7px 12px; font-size: .82rem; }
.nominees-card { padding: 18px; }
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
h2 { margin: 0; font-size: 1.15rem; }
select { border: 1px solid var(--border); border-radius: 11px; padding: 9px 10px; font: inherit; }
.category-groups { display: grid; gap: 14px; }
.category-group { border: 1px solid var(--border); border-radius: 18px; padding: 12px; background: #fff; }
.category-title { margin: 0 0 10px; font-size: 1rem; }
.nominee-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
.nominee-card { border: 1px solid var(--border); border-radius: 14px; padding: 12px; background: #fff; display: grid; gap: 8px; }
.nominee-card h4 { margin: 0; font-size: .95rem; }
.nominee-meta { font-size: .8rem; color: var(--muted); }
.stats { display: flex; justify-content: space-between; align-items: center; }
.stats b { color: var(--gold); font-size: .88rem; }
.cta-row { display: flex; gap: 8px; }
.cta-row a { flex: 1; text-align: center; text-decoration: none; border-radius: 10px; padding: 9px 10px; font-size: .82rem; font-weight: 700; }
.cta-vote { background: var(--brand); color: #fff; }
.cta-vote:hover { background: var(--brand-strong); }
.cta-view { background: #f3f5f8; color: #334155; }
.empty { margin: 10px 0 0; color: var(--muted); }
@media (max-width: 680px) { .toolbar { flex-direction: column; align-items: stretch; } }
`,
  jsContent: `
(function () {
  const FALLBACK = {{voting.nomineesByCategory}};
  const categories = Array.isArray(FALLBACK) ? FALLBACK : [];
  const categoryFilter = document.getElementById('categoryFilter');
  const categoryGroups = document.getElementById('categoryGroups');

  function renderFilter() {
    if (!categoryFilter) return;
    categoryFilter.innerHTML = ['<option value="">All categories</option>']
      .concat(categories.map(function (group) { return '<option value="' + esc(group.contestId) + '">' + esc(group.title) + '</option>'; }))
      .join('');
  }

  function renderGroups() {
    if (!categoryGroups) return;
    const selected = categoryFilter ? categoryFilter.value : '';
    const filtered = categories.filter(function (group) {
      return !selected || group.contestId === selected;
    });
    if (!filtered.length) {
      categoryGroups.innerHTML = '<p class="empty">No nominees are available yet.</p>';
      return;
    }

    categoryGroups.innerHTML = filtered.map(function (group) {
      const cards = (group.nominees || []).map(function (nominee) {
        const voteUrl = '{{urls.vote}}?contestId=' + encodeURIComponent(group.contestId) + '&optionId=' + encodeURIComponent(nominee.id);
        const percent = Number(nominee.voteSharePercent || 0);
        return '<article class="nominee-card">' +
          '<h4>' + esc(nominee.name) + '</h4>' +
          '<p class="nominee-meta">' + esc(nominee.description || 'Nominee profile') + '</p>' +
          '<div class="stats"><span>Total Votes</span><b>' + Number(nominee.totalVotes || 0) + ' (' + percent.toFixed(1) + '%)</b></div>' +
          '<div class="cta-row">' +
            '<a class="cta-vote" href="' + voteUrl + '">Vote</a>' +
            '<a class="cta-view" href="{{urls.leaderboard}}?contestId=' + encodeURIComponent(group.contestId) + '">Leaderboard</a>' +
          '</div>' +
        '</article>';
      }).join('');
      return '<section class="category-group">' +
        '<h3 class="category-title">' + esc(group.title) + '</h3>' +
        '<div class="nominee-grid">' + cards + '</div>' +
      '</section>';
    }).join('');
  }

  function esc(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  if (categoryFilter) {
    categoryFilter.addEventListener('change', renderGroups);
  }
  renderFilter();
  renderGroups();
})();
`,
};

export const DEFAULT_VOTING_LEADERBOARD_TEMPLATE = {
  id: 'default-voting-leaderboard',
  name: 'Voting Leaderboard Starter',
  description: 'Public leaderboard page with category filtering and trend indicators.',
  type: 'VOTING_LEADERBOARD',
  isDefault: true,
  htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{event.name}} · Leaderboard</title>
</head>
<body>
  <main class="lb-shell">
    <header class="lb-hero">
      <p class="eyebrow">Leaderboard</p>
      <h1>{{event.name}}</h1>
      <p class="sub">Live ranking by category with vote totals and movement insights.</p>
      <nav class="hero-links">
        <a href="{{urls.nominees}}">Nominees</a>
        <a href="{{urls.vote}}">Vote now</a>
        <a href="{{urls.nominate}}">Nominate</a>
      </nav>
    </header>

    <section class="lb-card">
      <div class="toolbar">
        <h2>Category Ranking</h2>
        <div class="toolbar-actions">
          <select id="contestFilter"></select>
          <button id="refreshBtn" type="button">Refresh</button>
        </div>
      </div>
      <div id="leaderboardList" class="leaderboard-list"></div>
      <p id="status" class="status">Ready.</p>
    </section>
  </main>
</body>
</html>`,
  cssContent: `
:root {
  --bg: radial-gradient(circle at top, #ffefe9, #f7fafc 34%, #edf1f5 100%);
  --card: #fff;
  --text: #0f172a;
  --muted: #556174;
  --border: #e5e9ef;
  --brand: #ff3b30;
  --brand-strong: #de2d22;
  --gold: #b6861f;
  --green: #0f9f67;
  --shadow: 0 18px 44px rgba(15, 23, 42, .08);
}
* { box-sizing: border-box; }
body { margin: 0; font-family: "Plus Jakarta Sans", "Inter", sans-serif; color: var(--text); background: var(--bg); }
.lb-shell { width: min(980px, 100% - 24px); margin: 24px auto 44px; display: grid; gap: 16px; }
.lb-hero, .lb-card { border: 1px solid var(--border); border-radius: 24px; box-shadow: var(--shadow); background: var(--card); }
.lb-hero { padding: 20px; background: linear-gradient(134deg, #101418 0%, #242c34 56%, #2d3640 100%); color: #fff; }
.eyebrow { margin: 0; text-transform: uppercase; letter-spacing: .11em; font-size: .72rem; font-weight: 700; color: #ffd7c3; }
.lb-hero h1 { margin: 8px 0 0; font-size: clamp(1.8rem, 4.4vw, 2.7rem); }
.sub { margin: 8px 0 0; color: #dde6ef; }
.hero-links { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
.hero-links a { color: #fff; text-decoration: none; border: 1px solid rgba(255,255,255,.24); border-radius: 999px; padding: 7px 12px; font-size: .82rem; }
.lb-card { padding: 18px; }
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
h2 { margin: 0; font-size: 1.16rem; }
.toolbar-actions { display: flex; gap: 8px; }
select, button { font: inherit; }
select { border: 1px solid var(--border); border-radius: 11px; padding: 9px 10px; }
#refreshBtn { border: none; border-radius: 11px; background: var(--brand); color: #fff; padding: 9px 12px; font-weight: 700; cursor: pointer; }
#refreshBtn:hover { background: var(--brand-strong); }
.leaderboard-list { display: grid; gap: 12px; }
.lb-contest { border: 1px solid var(--border); border-radius: 16px; padding: 12px; background: #fff; }
.lb-contest h3 { margin: 0 0 9px; font-size: 1rem; }
.lb-row { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px dashed var(--border); }
.lb-row:last-child { border-bottom: none; }
.rank { width: 30px; height: 30px; border-radius: 10px; background: #f4f7fa; display: grid; place-items: center; font-weight: 700; color: #334155; }
.lb-row:first-child .rank { background: color-mix(in srgb, var(--gold) 18%, #fff); color: #7c5a0f; }
.name { font-weight: 600; }
.votes { font-weight: 700; color: var(--gold); }
.trend { font-size: .8rem; font-weight: 700; }
.trend.up { color: var(--green); }
.trend.down { color: #b42318; }
.status { margin: 10px 0 0; color: var(--muted); font-size: .82rem; }
.status.error { color: #b42318; }
@media (max-width: 720px) {
  .toolbar { flex-direction: column; align-items: stretch; }
  .toolbar-actions { width: 100%; }
  .toolbar-actions select, .toolbar-actions button { flex: 1; }
  .lb-row { grid-template-columns: auto 1fr auto; }
  .trend { grid-column: 2 / 4; justify-self: end; }
}
`,
  jsContent: `
(function () {
  const EVENT_SLUG = "{{event.slug}}";
  const API_BASE = ("{{api.baseUrl}}" || window.location.origin).replace(/\\/+$/, "") + "/api";
  const contestFilter = document.getElementById('contestFilter');
  const leaderboardList = document.getElementById('leaderboardList');
  const refreshBtn = document.getElementById('refreshBtn');
  const statusEl = document.getElementById('status');

  let contests = Array.isArray({{voting.leaderboard}}) ? {{voting.leaderboard}} : [];

  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.toggle('error', Boolean(isError));
  }

  function renderFilter() {
    if (!contestFilter) return;
    contestFilter.innerHTML = ['<option value="">All categories</option>']
      .concat(contests.map(function (contest) {
        return '<option value="' + esc(contest.contestId) + '">' + esc(contest.title) + '</option>';
      }))
      .join('');
  }

  function renderLeaderboard() {
    if (!leaderboardList) return;
    const selected = contestFilter ? contestFilter.value : '';
    const filtered = contests.filter(function (contest) {
      return !selected || contest.contestId === selected;
    });

    if (!filtered.length) {
      leaderboardList.innerHTML = '<p class="status">No leaderboard entries yet.</p>';
      return;
    }

    leaderboardList.innerHTML = filtered.map(function (contest) {
      const rows = (contest.rankings || []).map(function (entry) {
        const delta = Number(entry.trendDelta || 0);
        const trendClass = delta > 0 ? 'up' : delta < 0 ? 'down' : '';
        const trendLabel = delta > 0 ? '+' + delta : String(delta);
        return '<div class="lb-row">' +
          '<span class="rank">#' + Number(entry.rank || 0) + '</span>' +
          '<span class="name">' + esc(entry.name || 'Nominee') + '</span>' +
          '<span class="votes">' + Number(entry.totalVotes || 0) + '</span>' +
          '<span class="trend ' + trendClass + '">' + (delta ? trendLabel + ' (24h)' : 'No change') + '</span>' +
        '</div>';
      }).join('');

      return '<article class="lb-contest">' +
        '<h3>' + esc(contest.title) + '</h3>' +
        rows +
      '</article>';
    }).join('');
  }

  async function refreshLeaderboard() {
    try {
      setStatus('Refreshing leaderboard...');
      const contestId = contestFilter && contestFilter.value ? '?contestId=' + encodeURIComponent(contestFilter.value) : '';
      const response = await fetch(API_BASE + '/voting/public/' + encodeURIComponent(EVENT_SLUG) + '/leaderboard' + contestId, {
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        throw new Error(payload.error || payload.message || ('Request failed (' + response.status + ')'));
      }
      contests = Array.isArray(payload.contests) ? payload.contests : contests;
      renderFilter();
      renderLeaderboard();
      setStatus('Leaderboard refreshed.');
    } catch (error) {
      setStatus(error.message || 'Failed to refresh leaderboard', true);
    }
  }

  function esc(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  if (contestFilter) {
    contestFilter.addEventListener('change', renderLeaderboard);
  }
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function () { void refreshLeaderboard(); });
  }

  renderFilter();
  renderLeaderboard();
})();
`,
};
