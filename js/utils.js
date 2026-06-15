// Допоміжні утиліти форматування та відображення.

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function fmtDate(d) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

function fmtNum(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

function fmtPercent(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toFixed(digits) + "%";
}

/**
 * Повертає клас "good" / "warn" / "bad" залежно від значення та порогів.
 * За замовчуванням: менше = краще (наприклад, % повторних звернень).
 * inverse=true: більше = краще.
 */
function levelClass(value, warnThreshold, badThreshold, inverse = false) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  if (!inverse) {
    if (value >= badThreshold) return "bad";
    if (value >= warnThreshold) return "warn";
    return "good";
  }
  if (value <= badThreshold) return "bad";
  if (value <= warnThreshold) return "warn";
  return "good";
}

function badge(text, level) {
  return `<span class="badge ${level}">${escapeHtml(text)}</span>`;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) =>
    row.map((cell) => {
      const s = String(cell ?? "");
      return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(";")
  ).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function el(tag, attrs = {}, html = "") {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  }
  if (html) node.innerHTML = html;
  return node;
}

/** Прикріплює сортування по клавіату th[data-key] для таблиці. */
function enableTableSort(table) {
  table.querySelectorAll("th[data-key]").forEach((th) => {
    th.addEventListener("click", () => {
      const tbody = table.querySelector("tbody");
      const rows = [...tbody.querySelectorAll("tr")];
      const idx = [...th.parentElement.children].indexOf(th);
      const asc = th.dataset.asc !== "true";
      table.querySelectorAll("th[data-key]").forEach((h) => delete h.dataset.asc);
      th.dataset.asc = asc;
      rows.sort((a, b) => {
        const av = a.children[idx].dataset.sort ?? a.children[idx].textContent.trim();
        const bv = b.children[idx].dataset.sort ?? b.children[idx].textContent.trim();
        const an = parseFloat(String(av).replace(",", "."));
        const bn = parseFloat(String(bv).replace(",", "."));
        let cmp;
        if (!Number.isNaN(an) && !Number.isNaN(bn)) cmp = an - bn;
        else cmp = String(av).localeCompare(String(bv), "uk");
        return asc ? cmp : -cmp;
      });
      rows.forEach((r) => tbody.appendChild(r));
    });
  });
}
