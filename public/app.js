// NCPA Sound Inventory — mobile crew UI
// State held in module-scope vars; persisted bits in localStorage.

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const state = {
  crew: [],
  venues: [],
  selectedCrewId: Number(localStorage.getItem("crew_id")) || null,
  view: "checkout",
  checkoutItems: [],
  returnItems: [],
  selectedIds: new Set(),
};

const api = {
  async get(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error((await r.json()).error || r.statusText);
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || r.statusText);
    return data;
  },
};

function toast(msg, kind = "good") {
  const el = $("#toast");
  el.textContent = msg;
  el.className = `toast ${kind}`;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.hidden = true), 3500);
}

function fmtRel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function fmtDateTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString();
}

// ---- bootstrap & crew picker ----------------------------------------------

async function bootstrap() {
  const data = await api.get("/api/bootstrap");
  state.crew = data.crew;
  state.venues = data.venues;

  const crewSel = $("#crew-select");
  crewSel.innerHTML =
    '<option value="">— select your name —</option>' +
    state.crew
      .map(
        (c) =>
          `<option value="${c.id}">${escapeHtml(c.name)}${c.role === "head" ? " (Head)" : ""}</option>`,
      )
      .join("");
  if (state.selectedCrewId) crewSel.value = String(state.selectedCrewId);

  for (const id of ["from-venue", "to-venue", "return-other-venue"]) {
    const sel = document.getElementById(id);
    sel.innerHTML =
      '<option value="">— select venue —</option>' +
      state.venues
        .map((v) => `<option value="${v.id}">${escapeHtml(v.name)} (${v.code})</option>`)
        .join("");
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setCrew(id) {
  state.selectedCrewId = Number(id) || null;
  if (state.selectedCrewId) localStorage.setItem("crew_id", state.selectedCrewId);
  else localStorage.removeItem("crew_id");
  refreshAll();
}

// ---- view switching --------------------------------------------------------

function setView(name) {
  state.view = name;
  state.selectedIds.clear();
  updateActionBar();
  $$(".view").forEach((v) => (v.hidden = v.id !== `view-${name}`));
  $$(".tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  if (name === "checkout") loadCheckout();
  if (name === "return") loadReturn();
  if (name === "history") loadHistory();
  if (name === "alerts") loadAlerts();
}

// ---- checkout view ---------------------------------------------------------

async function loadCheckout() {
  const venueId = Number($("#from-venue").value);
  const list = $("#checkout-items");
  if (!venueId) {
    list.innerHTML = '<div class="empty">Pick a venue to see items.</div>';
    return;
  }
  list.innerHTML = '<div class="empty">Loading…</div>';
  try {
    const { items } = await api.get(`/api/items?venue_id=${venueId}`);
    state.checkoutItems = items;
    renderCheckoutList();
  } catch (e) {
    list.innerHTML = `<div class="empty">Error: ${escapeHtml(e.message)}</div>`;
  }
}

function renderCheckoutList() {
  const q = ($("#checkout-search").value || "").toLowerCase().trim();
  const filtered = q
    ? state.checkoutItems.filter(
        (i) =>
          i.label.toLowerCase().includes(q) ||
          (i.model_name || "").toLowerCase().includes(q) ||
          (i.category || "").toLowerCase().includes(q),
      )
    : state.checkoutItems;

  const list = $("#checkout-items");
  if (!filtered.length) {
    list.innerHTML = '<div class="empty">No items match.</div>';
    return;
  }

  let html = "";
  let lastCat = null;
  for (const it of filtered) {
    if (it.category !== lastCat) {
      lastCat = it.category;
      html += `<div class="cat-header">${escapeHtml(lastCat)}</div>`;
    }
    const checked = state.selectedIds.has(it.id);
    html += `<label class="item ${checked ? "checked" : ""}">
      <input type="checkbox" data-id="${it.id}" ${checked ? "checked" : ""} />
      <div class="body">
        <div class="label">${escapeHtml(it.label)}</div>
        <div class="meta">Home: ${escapeHtml(it.home_venue_code)}</div>
      </div>
    </label>`;
  }
  list.innerHTML = html;
}

// ---- return view -----------------------------------------------------------

async function loadReturn() {
  const list = $("#return-items");
  if (!state.selectedCrewId) {
    list.innerHTML = '<div class="empty">Select your name first.</div>';
    return;
  }
  list.innerHTML = '<div class="empty">Loading…</div>';
  try {
    const { items } = await api.get(`/api/items/checked-out?crew_id=${state.selectedCrewId}`);
    state.returnItems = items;
    renderReturnList();
  } catch (e) {
    list.innerHTML = `<div class="empty">Error: ${escapeHtml(e.message)}</div>`;
  }
}

function renderReturnList() {
  const list = $("#return-items");
  if (!state.returnItems.length) {
    list.innerHTML = '<div class="empty">You\'re not holding any items.</div>';
    return;
  }
  let html = "";
  let lastCat = null;
  for (const it of state.returnItems) {
    if (it.category !== lastCat) {
      lastCat = it.category;
      html += `<div class="cat-header">${escapeHtml(lastCat)}</div>`;
    }
    const checked = state.selectedIds.has(it.id);
    const dest = it.destination_venue_name
      ? `→ ${escapeHtml(it.destination_venue_code)}`
      : "";
    html += `<label class="item ${checked ? "checked" : ""}">
      <input type="checkbox" data-id="${it.id}" ${checked ? "checked" : ""} />
      <div class="body">
        <div class="label">${escapeHtml(it.label)}</div>
        <div class="meta">Home: ${escapeHtml(it.home_venue_code)} ${dest} · taken ${fmtRel(it.last_movement_at)}</div>
      </div>
    </label>`;
  }
  list.innerHTML = html;
}

// ---- history view ----------------------------------------------------------

async function loadHistory() {
  const el = $("#history-list");
  el.innerHTML = '<div class="empty">Loading…</div>';
  const params = new URLSearchParams({ limit: "100" });
  if (state.selectedCrewId) params.set("crew_id", String(state.selectedCrewId));
  try {
    const { movements } = await api.get(`/api/history?${params}`);
    if (!movements.length) {
      el.innerHTML = '<div class="empty">No movements yet.</div>';
      return;
    }
    el.innerHTML = movements
      .map((m) => {
        const arrow = m.action === "checkout" ? "→" : "↩";
        const from = m.from_code || "—";
        const to = m.to_code || "—";
        return `<div class="move ${m.action}">
          <div class="when">${fmtDateTime(m.created_at)} · ${escapeHtml(m.crew_name)}</div>
          <div class="what">${escapeHtml(m.item_label)}</div>
          <div class="small muted">${from} <span class="arrow">${arrow}</span> ${to}${m.notes ? ` · ${escapeHtml(m.notes)}` : ""}</div>
        </div>`;
      })
      .join("");
  } catch (e) {
    el.innerHTML = `<div class="empty">Error: ${escapeHtml(e.message)}</div>`;
  }
}

// ---- alerts view -----------------------------------------------------------

async function loadAlerts() {
  const el = $("#alerts-list");
  el.innerHTML = '<div class="empty">Loading…</div>';
  try {
    const { items } = await api.get("/api/items/unreturned?days=5");
    updateAlertBanner(items.length);
    if (!items.length) {
      el.innerHTML = '<div class="empty">All clear — nothing overdue.</div>';
      return;
    }
    el.innerHTML = items
      .map((it) => {
        const dest = it.destination_venue_code ? ` → ${escapeHtml(it.destination_venue_code)}` : "";
        return `<div class="move checkout">
          <div class="when">${fmtRel(it.last_movement_at)} · ${escapeHtml(it.crew_name)}</div>
          <div class="what">${escapeHtml(it.label)}</div>
          <div class="small muted">Home: ${escapeHtml(it.home_venue_code)}${dest}</div>
        </div>`;
      })
      .join("");
  } catch (e) {
    el.innerHTML = `<div class="empty">Error: ${escapeHtml(e.message)}</div>`;
  }
}

async function updateAlertBanner(countOverride) {
  let count = countOverride;
  if (count == null) {
    try {
      const { items } = await api.get("/api/items/unreturned?days=5");
      count = items.length;
    } catch {
      return;
    }
  }
  const banner = $("#alert-banner");
  $("#alert-count").textContent = String(count);
  banner.style.display = count > 0 ? "flex" : "none";
}

// ---- actions: submit checkout / return ------------------------------------

function updateActionBar() {
  const bar = $("#action-bar");
  const n = state.selectedIds.size;
  $("#action-count").textContent = String(n);
  if (n > 0 && (state.view === "checkout" || state.view === "return")) {
    bar.classList.add("show");
    $("#action-submit").textContent =
      state.view === "checkout" ? "Check out" : "Return";
  } else {
    bar.classList.remove("show");
  }
}

async function submitAction() {
  if (!state.selectedCrewId) {
    toast("Select your name first", "bad");
    return;
  }
  const ids = Array.from(state.selectedIds);
  if (!ids.length) return;

  const btn = $("#action-submit");
  btn.disabled = true;
  try {
    if (state.view === "checkout") {
      const fromId = Number($("#from-venue").value);
      const toId = Number($("#to-venue").value);
      if (!fromId) return toast("Choose pickup venue", "bad");
      if (!toId) return toast("Choose destination venue", "bad");
      if (fromId === toId) return toast("Pickup and destination must differ", "bad");
      await api.post("/api/checkout", {
        crew_id: state.selectedCrewId,
        from_venue_id: fromId,
        to_venue_id: toId,
        item_ids: ids,
      });
      toast(`Checked out ${ids.length} item${ids.length === 1 ? "" : "s"}`);
      state.selectedIds.clear();
      await loadCheckout();
    } else if (state.view === "return") {
      const destMode = document.querySelector('input[name="return-dest"]:checked').value;
      let destination = "home";
      if (destMode === "other") {
        const v = Number($("#return-other-venue").value);
        if (!v) return toast("Choose destination venue", "bad");
        destination = v;
      }
      await api.post("/api/return", {
        crew_id: state.selectedCrewId,
        item_ids: ids,
        destination,
      });
      toast(`Returned ${ids.length} item${ids.length === 1 ? "" : "s"}`);
      state.selectedIds.clear();
      await loadReturn();
    }
    updateAlertBanner();
  } catch (e) {
    toast(e.message, "bad");
  } finally {
    btn.disabled = false;
    updateActionBar();
  }
}

// ---- refresh helpers -------------------------------------------------------

function refreshAll() {
  state.selectedIds.clear();
  updateActionBar();
  if (state.view === "checkout") loadCheckout();
  if (state.view === "return") loadReturn();
  if (state.view === "history") loadHistory();
  if (state.view === "alerts") loadAlerts();
  updateAlertBanner();
}

// ---- wire up ---------------------------------------------------------------

function wire() {
  $("#crew-select").addEventListener("change", (e) => setCrew(e.target.value));
  $("#change-crew").addEventListener("click", () => {
    state.selectedCrewId = null;
    localStorage.removeItem("crew_id");
    $("#crew-select").value = "";
    refreshAll();
    toast("Pick your name to continue");
  });

  $("#from-venue").addEventListener("change", () => {
    state.selectedIds.clear();
    updateActionBar();
    loadCheckout();
  });

  $("#checkout-search").addEventListener("input", () => renderCheckoutList());

  $$('input[name="return-dest"]').forEach((r) =>
    r.addEventListener("change", () => {
      $("#return-other-venue").disabled = r.value === "home" || !r.checked;
      const otherChecked = document.querySelector('input[name="return-dest"][value="other"]').checked;
      $("#return-other-venue").disabled = !otherChecked;
    }),
  );

  document.body.addEventListener("change", (e) => {
    const cb = e.target;
    if (cb.matches('input[type="checkbox"][data-id]')) {
      const id = Number(cb.dataset.id);
      if (cb.checked) state.selectedIds.add(id);
      else state.selectedIds.delete(id);
      cb.closest(".item").classList.toggle("checked", cb.checked);
      updateActionBar();
    }
  });

  $$(".tabbar button").forEach((b) =>
    b.addEventListener("click", () => setView(b.dataset.view)),
  );

  $("#action-submit").addEventListener("click", submitAction);

  $("#alert-banner").addEventListener("click", () => setView("alerts"));
}

(async function init() {
  wire();
  try {
    await bootstrap();
    setView("checkout");
    updateAlertBanner();
  } catch (e) {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<div class="toast bad" style="position:static;margin:20px;">Failed to load: ${escapeHtml(e.message)}</div>`,
    );
  }
})();
