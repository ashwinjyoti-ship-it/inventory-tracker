// NCPA Sound Inventory — admin UI

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const escapeHtml = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const TOKEN_KEY = "admin_token";
let token = localStorage.getItem(TOKEN_KEY) || "";

function authHeader() {
  return token ? { authorization: `Bearer ${token}` } : {};
}

const api = {
  async get(path) {
    const r = await fetch(path, { headers: authHeader() });
    if (r.status === 401) { signOut(); throw new Error("session expired"); }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || r.statusText);
    return data;
  },
  async send(method, path, body) {
    const r = await fetch(path, {
      method,
      headers: { "content-type": "application/json", ...authHeader() },
      body: body == null ? undefined : JSON.stringify(body),
    });
    if (r.status === 401) { signOut(); throw new Error("session expired"); }
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
  toast._t = setTimeout(() => (el.hidden = true), 3000);
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

// ---- auth ------------------------------------------------------------------

async function signIn() {
  const pw = $("#login-pw").value;
  $("#login-err").textContent = "";
  if (!pw) return;
  try {
    const data = await api.send("POST", "/api/admin/login", { password: pw });
    token = data.token;
    localStorage.setItem(TOKEN_KEY, token);
    showApp();
  } catch (e) {
    $("#login-err").textContent = e.message;
  }
}

function signOut() {
  token = "";
  localStorage.removeItem(TOKEN_KEY);
  $("#app").hidden = true;
  $("#login").hidden = false;
  $("#login-pw").value = "";
}

async function showApp() {
  $("#login").hidden = true;
  $("#app").hidden = false;
  await loadOptions();
  setView("equipment");
}

// ---- shared dropdown options ----------------------------------------------

async function loadOptions() {
  const data = await fetch("/api/bootstrap").then((r) => r.json());
  const venueOpts =
    '<option value="">All</option>' +
    data.venues.map((v) => `<option value="${v.id}">${escapeHtml(v.name)} (${v.code})</option>`).join("");
  $("#eq-venue").innerHTML = venueOpts;
  $("#mv-venue").innerHTML = venueOpts;
  const crewOpts =
    '<option value="">All</option>' + data.crew.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  $("#mv-crew").innerHTML = crewOpts;
}

// ---- view switching --------------------------------------------------------

function setView(name) {
  $$(".admin .view").forEach((v) => (v.hidden = v.id !== `view-${name}`));
  $$(".admin nav.tabs button").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === name),
  );
  if (name === "equipment") loadEquipment();
  if (name === "movements") loadMovements();
  if (name === "venues") loadVenues();
  if (name === "crew") loadCrew();
}

// ---- equipment -------------------------------------------------------------

async function loadEquipment() {
  const params = new URLSearchParams();
  const q = $("#eq-search").value.trim();
  const cat = $("#eq-category").value;
  const venue = $("#eq-venue").value;
  const status = $("#eq-status").value;
  if (q) params.set("q", q);
  if (cat) params.set("category", cat);
  if (venue) params.set("venue_id", venue);
  if (status) params.set("status", status);

  const tbody = $("#eq-table tbody");
  tbody.innerHTML = '<tr><td colspan="7" class="loading">Loading…</td></tr>';
  try {
    const { items } = await api.get(`/api/admin/equipment?${params}`);
    populateCategoryFilter(items);
    $("#eq-summary").textContent = `${items.length} item${items.length === 1 ? "" : "s"}`;
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading">No items.</td></tr>';
      return;
    }
    tbody.innerHTML = items
      .map((it) => {
        let location, holder, heading;
        if (it.crew_id) {
          location = `<span class="tag warn">In transit</span>`;
          holder = escapeHtml(it.crew_name);
          heading = it.dest_code ? `${escapeHtml(it.dest_code)}` : "—";
        } else {
          const here = it.current_code || "—";
          const tag =
            it.current_venue_id && it.current_venue_id == it.home_venue_id
              ? `<span class="tag good">home</span>`
              : `<span class="tag">away</span>`;
          location = `${escapeHtml(here)} ${tag}`;
          holder = "—";
          heading = "—";
        }
        return `<tr>
          <td>${escapeHtml(it.label)}</td>
          <td><span class="tag">${escapeHtml(it.category)}</span></td>
          <td>${escapeHtml(it.home_code)}</td>
          <td>${location}</td>
          <td>${holder}</td>
          <td>${heading}</td>
          <td class="muted">${fmtDateTime(it.last_movement_at)}</td>
        </tr>`;
      })
      .join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="loading">Error: ${escapeHtml(e.message)}</td></tr>`;
  }
}

function populateCategoryFilter(items) {
  const sel = $("#eq-category");
  if (sel.options.length > 1) return;
  const cats = Array.from(new Set(items.map((i) => i.category))).sort();
  sel.innerHTML =
    '<option value="">All</option>' + cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
}

// ---- movements -------------------------------------------------------------

async function loadMovements() {
  const params = new URLSearchParams();
  const c = $("#mv-crew").value;
  const v = $("#mv-venue").value;
  const lim = $("#mv-limit").value;
  if (c) params.set("crew_id", c);
  if (v) params.set("venue_id", v);
  params.set("limit", lim);
  const tbody = $("#mv-table tbody");
  tbody.innerHTML = '<tr><td colspan="7" class="loading">Loading…</td></tr>';
  try {
    const { movements } = await api.get(`/api/history?${params}`);
    if (!movements.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading">No movements.</td></tr>';
      return;
    }
    tbody.innerHTML = movements
      .map((m) => {
        const tag = m.action === "checkout" ? `<span class="tag warn">checkout</span>` : `<span class="tag good">return</span>`;
        return `<tr>
          <td>${fmtDateTime(m.created_at)}</td>
          <td>${tag}</td>
          <td>${escapeHtml(m.item_label)}</td>
          <td>${escapeHtml(m.from_code || "—")}</td>
          <td>${escapeHtml(m.to_code || "—")}</td>
          <td>${escapeHtml(m.crew_name)}</td>
          <td class="muted">${escapeHtml(m.notes || "")}</td>
        </tr>`;
      })
      .join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="loading">Error: ${escapeHtml(e.message)}</td></tr>`;
  }
}

// ---- venues ----------------------------------------------------------------

async function loadVenues() {
  const tbody = $("#v-table tbody");
  tbody.innerHTML = '<tr><td colspan="6" class="loading">Loading…</td></tr>';
  try {
    const { venues } = await api.get("/api/admin/venues");
    tbody.innerHTML = venues
      .map(
        (v) => `<tr>
        <td><input type="text" data-id="${v.id}" data-field="name" value="${escapeHtml(v.name)}" /></td>
        <td><input type="text" data-id="${v.id}" data-field="code" value="${escapeHtml(v.code)}" style="max-width:120px;" /></td>
        <td><input type="checkbox" data-id="${v.id}" data-field="is_outdoor" ${v.is_outdoor ? "checked" : ""} /></td>
        <td><input type="checkbox" data-id="${v.id}" data-field="active" ${v.active ? "checked" : ""} /></td>
        <td class="muted">${v.home_count} / ${v.current_count}</td>
        <td class="row">
          <button class="secondary" data-action="save-venue" data-id="${v.id}">Save</button>
          <button class="danger" data-action="delete-venue" data-id="${v.id}">Delete</button>
        </td>
      </tr>`,
      )
      .join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading">Error: ${escapeHtml(e.message)}</td></tr>`;
  }
}

async function addVenue() {
  const name = $("#v-name").value.trim();
  const code = $("#v-code").value.trim();
  if (!name || !code) return toast("Name and code required", "bad");
  try {
    await api.send("POST", "/api/admin/venues", {
      name, code, is_outdoor: $("#v-outdoor").checked,
    });
    $("#v-name").value = ""; $("#v-code").value = ""; $("#v-outdoor").checked = false;
    toast("Venue added");
    await loadVenues();
    await loadOptions();
  } catch (e) { toast(e.message, "bad"); }
}

async function saveVenue(id) {
  const get = (f) => document.querySelector(`#v-table input[data-id="${id}"][data-field="${f}"]`);
  try {
    await api.send("PUT", "/api/admin/venues", {
      id,
      name: get("name").value.trim(),
      code: get("code").value.trim(),
      is_outdoor: get("is_outdoor").checked,
      active: get("active").checked,
    });
    toast("Saved");
    await loadOptions();
  } catch (e) { toast(e.message, "bad"); }
}

async function deleteVenue(id) {
  if (!confirm("Delete this venue? If in use it will be deactivated instead.")) return;
  try {
    const r = await api.send("DELETE", `/api/admin/venues?id=${id}`);
    toast(r.soft ? "Venue deactivated (in use)" : "Venue deleted");
    await loadVenues();
    await loadOptions();
  } catch (e) { toast(e.message, "bad"); }
}

// ---- crew ------------------------------------------------------------------

async function loadCrew() {
  const tbody = $("#c-table tbody");
  tbody.innerHTML = '<tr><td colspan="5" class="loading">Loading…</td></tr>';
  try {
    const { crew } = await api.get("/api/admin/crew");
    tbody.innerHTML = crew
      .map(
        (c) => `<tr>
        <td><input type="text" data-id="${c.id}" data-field="name" value="${escapeHtml(c.name)}" /></td>
        <td>
          <select data-id="${c.id}" data-field="role" style="max-width:140px;">
            <option value="member" ${c.role === "member" ? "selected" : ""}>Member</option>
            <option value="head" ${c.role === "head" ? "selected" : ""}>Head</option>
          </select>
        </td>
        <td><input type="checkbox" data-id="${c.id}" data-field="active" ${c.active ? "checked" : ""} /></td>
        <td class="muted">${c.holding_count}</td>
        <td class="row">
          <button class="secondary" data-action="save-crew" data-id="${c.id}">Save</button>
          <button class="danger" data-action="delete-crew" data-id="${c.id}">Delete</button>
        </td>
      </tr>`,
      )
      .join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="loading">Error: ${escapeHtml(e.message)}</td></tr>`;
  }
}

async function addCrew() {
  const name = $("#c-name").value.trim();
  const role = $("#c-role").value;
  if (!name) return toast("Name required", "bad");
  try {
    await api.send("POST", "/api/admin/crew", { name, role });
    $("#c-name").value = "";
    toast("Crew member added");
    await loadCrew();
    await loadOptions();
  } catch (e) { toast(e.message, "bad"); }
}

async function saveCrew(id) {
  const get = (f) => document.querySelector(`#c-table [data-id="${id}"][data-field="${f}"]`);
  try {
    await api.send("PUT", "/api/admin/crew", {
      id,
      name: get("name").value.trim(),
      role: get("role").value,
      active: get("active").checked,
    });
    toast("Saved");
    await loadOptions();
  } catch (e) { toast(e.message, "bad"); }
}

async function changePassword() {
  const current = prompt("Current admin password:");
  if (!current) return;
  const next = prompt("New admin password (min 6 chars):");
  if (!next) return;
  const next2 = prompt("Confirm new password:");
  if (next !== next2) return toast("Passwords don't match", "bad");
  try {
    await api.send("POST", "/api/admin/password", { current, next });
    toast("Password changed");
  } catch (e) { toast(e.message, "bad"); }
}

async function deleteCrew(id) {
  if (!confirm("Delete this crew member? If they have history they'll be deactivated instead.")) return;
  try {
    const r = await api.send("DELETE", `/api/admin/crew?id=${id}`);
    toast(r.soft ? "Deactivated (has history)" : "Deleted");
    await loadCrew();
    await loadOptions();
  } catch (e) { toast(e.message, "bad"); }
}

// ---- wire ------------------------------------------------------------------

function wire() {
  $("#login-btn").addEventListener("click", signIn);
  $("#login-pw").addEventListener("keydown", (e) => { if (e.key === "Enter") signIn(); });
  $("#logout").addEventListener("click", signOut);
  $("#change-password").addEventListener("click", changePassword);

  $$(".admin nav.tabs button").forEach((b) =>
    b.addEventListener("click", () => setView(b.dataset.view)),
  );

  ["eq-search", "eq-category", "eq-venue", "eq-status"].forEach((id) =>
    document.getElementById(id).addEventListener("change", loadEquipment),
  );
  $("#eq-search").addEventListener("input", debounce(loadEquipment, 250));
  $("#eq-refresh").addEventListener("click", loadEquipment);

  ["mv-crew", "mv-venue", "mv-limit"].forEach((id) =>
    document.getElementById(id).addEventListener("change", loadMovements),
  );
  $("#mv-refresh").addEventListener("click", loadMovements);

  $("#v-add").addEventListener("click", addVenue);
  $("#c-add").addEventListener("click", addCrew);

  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const a = btn.dataset.action;
    if (a === "save-venue") saveVenue(id);
    if (a === "delete-venue") deleteVenue(id);
    if (a === "save-crew") saveCrew(id);
    if (a === "delete-crew") deleteCrew(id);
  });
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

(async function init() {
  wire();
  if (token) {
    // Verify token by hitting an admin endpoint.
    try {
      await api.get("/api/admin/venues");
      showApp();
      return;
    } catch {
      signOut();
    }
  }
  $("#login").hidden = false;
})();
