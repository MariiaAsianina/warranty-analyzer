// Точка входу: захист паролем, завантаження файлу, глобальні фільтри, перемикання вкладок.

const AUTH_HASH = "66efc76f356181319ed35d9a62470a72f500d566097b72f6aec503ab7a71381e";

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function unlockApp() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("site-content").style.display = "";
}

async function checkLogin() {
  const pass = document.getElementById("login-pass").value;
  if (await sha256Hex(pass) === AUTH_HASH) {
    sessionStorage.setItem("warranty_auth", "1");
    unlockApp();
  } else {
    document.getElementById("login-error").classList.add("on");
  }
}

if (sessionStorage.getItem("warranty_auth") === "1") {
  unlockApp();
} else {
  document.getElementById("login-pass").focus();
  document.getElementById("login-btn").addEventListener("click", checkLogin);
  document.getElementById("login-pass").addEventListener("keydown", (e) => {
    if (e.key === "Enter") checkLogin();
  });
}

const TABS = {
  dashboard: TabDashboard,
  imei: TabImei,
  owners: TabOwners,
  masters: TabMasters,
  models: TabModels,
  reasons: TabReasons,
  details: TabDetails
};

let activeTab = "dashboard";

const fileInput = document.getElementById("file-input");
const fileNameEl = document.getElementById("file-name");
const errorEl = document.getElementById("error");
const appEl = document.getElementById("app");
const tabContent = document.getElementById("tab-content");

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  errorEl.hidden = true;
  errorEl.textContent = "";
  fileNameEl.textContent = "Аналіз файлу…";
  try {
    const buffer = await file.arrayBuffer();
    const records = parseWorkbookBuffer(buffer);
    setRecords(records);
    fileNameEl.textContent = file.name;
    appEl.hidden = false;
    populateFilterOptions(records);
    renderActiveTab();
  } catch (err) {
    console.error(err);
    fileNameEl.textContent = "";
    appEl.hidden = true;
    errorEl.hidden = false;
    errorEl.textContent = "Помилка читання файлу: " + err.message;
  }
});

function populateFilterOptions(records) {
  fillSelect("f-model", uniqueValues(records, (r) => `${r.brand || ""} ${r.model || ""}`.trim()));
  fillSelect("f-owner", uniqueValues(records, (r) => r.owner || "Невідомо"));
  fillSelect("f-store", uniqueValues(records, (r) => r.store || "Невідомо"));
  fillSelect("f-master", uniqueMasters(records));
  fillSelect("f-reason", uniqueValues(records, (r) => r.reason || "Невідомо"));
}

function uniqueMasters(records) {
  const set = new Set();
  for (const r of records) {
    for (const m of r.repairMasters || []) set.add(m);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "uk"));
}

function fillSelect(id, values) {
  const select = document.getElementById(id);
  const current = select.value;
  select.innerHTML = `<option value="">Усі</option>` + values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
  if (values.includes(current)) select.value = current;
}

function renderActiveTab() {
  const data = getFilteredData();
  TABS[activeTab].render(tabContent, data);
}

document.getElementById("tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;
  activeTab = btn.dataset.tab;
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
  renderActiveTab();
});

const filterBindings = [
  ["f-date-from", "dateFrom"],
  ["f-date-to", "dateTo"],
  ["f-model", "model"],
  ["f-imei", "imei"],
  ["f-owner", "owner"],
  ["f-store", "store"],
  ["f-master", "master"],
  ["f-reason", "reason"],
  ["f-min-repairs", "minRepairs"],
  ["f-problem", "problem"]
];

for (const [id, key] of filterBindings) {
  const el = document.getElementById(id);
  const eventName = el.tagName === "SELECT" || el.type === "date" ? "change" : "input";
  el.addEventListener(eventName, () => {
    setFilter(key, el.value);
    renderActiveTab();
  });
}

document.getElementById("f-reset").addEventListener("click", () => {
  resetFilters();
  for (const [id, key] of filterBindings) {
    const el = document.getElementById(id);
    el.value = key === "minRepairs" ? "0" : key === "problem" ? "all" : "";
  }
  renderActiveTab();
});
