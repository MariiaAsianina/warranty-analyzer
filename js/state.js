// Глобальний стан додатку: записи, фільтри та похідні (відфільтровані) дані.

const state = {
  records: [],
  filters: {
    dateFrom: "",
    dateTo: "",
    model: "",
    imei: "",
    owner: "",
    store: "",
    master: "",
    reason: "",
    minRepairs: 0,
    problem: "all" // all | problem | normal
  }
};

function setRecords(records) {
  state.records = records;
}

function setFilter(key, value) {
  state.filters[key] = value;
}

function resetFilters() {
  state.filters = {
    dateFrom: "", dateTo: "", model: "", imei: "", owner: "", store: "",
    master: "", reason: "", minRepairs: 0, problem: "all"
  };
}

/** Записи після фільтрів рівня "запис" (дата, модель, власник, магазин, майстер, причина, IMEI). */
function getFilteredRecords() {
  const f = state.filters;
  const imeiQuery = f.imei.trim().toLowerCase();
  return state.records.filter((r) => {
    if (f.dateFrom && (!r.date || r.date < f.dateFrom)) return false;
    if (f.dateTo && (!r.date || r.date > f.dateTo)) return false;
    if (f.model && `${r.brand || ""} ${r.model || ""}`.trim() !== f.model) return false;
    if (f.owner && (r.owner || "Невідомо") !== f.owner) return false;
    if (f.store && (r.store || "") !== f.store) return false;
    if (f.master && !(r.repairMasters || []).includes(f.master)) return false;
    if (f.reason && (r.reason || "Невідомо") !== f.reason) return false;
    if (imeiQuery && !String(r.imei || "").toLowerCase().includes(imeiQuery)) return false;
    return true;
  });
}

/** Повертає { records, imeiAgg } після застосування всіх фільтрів, включно з IMEI-рівнем. */
function getFilteredData() {
  const f = state.filters;
  const preRecords = getFilteredRecords();
  let imeiAgg = aggregateByImei(preRecords);

  imeiAgg = imeiAgg.filter((r) => {
    if (f.minRepairs && r.repairCount < Number(f.minRepairs)) return false;
    if (f.problem === "problem" && !r.problem) return false;
    if (f.problem === "normal" && r.problem) return false;
    return true;
  });

  const imeiSet = new Set(imeiAgg.map((r) => r.imei));
  const records = preRecords.filter((r) => imeiSet.has(r.imei));
  return { records, imeiAgg };
}
