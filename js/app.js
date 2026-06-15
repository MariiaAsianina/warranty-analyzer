const fileInput = document.getElementById("file-input");
const summaryEl = document.getElementById("summary");
const content = document.getElementById("content");
const errorEl = document.getElementById("error");

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  errorEl.hidden = true;
  errorEl.textContent = "";
  summaryEl.innerHTML = "Аналіз файлу…";
  content.innerHTML = "";
  try {
    const buffer = await file.arrayBuffer();
    const records = parseWorkbookBuffer(buffer);
    render(records);
  } catch (err) {
    console.error(err);
    summaryEl.innerHTML = "";
    errorEl.hidden = false;
    errorEl.textContent = "Помилка читання файлу: " + err.message;
  }
});

function fmtDate(d) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

function fmtNum(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function render(records) {
  const imeis = aggregateByImei(records);
  const owners = aggregateByOwner(records);
  const masters = aggregateByMaster(records);

  renderSummary(records, imeis);
  content.innerHTML = `
    <div class="section">
      <h2>IMEI: повна історія та метрики</h2>
      <input type="text" class="search" id="search-imei" placeholder="Пошук за IMEI, моделлю, власником, майстром...">
      <div class="table-wrap">
        <table id="table-imei">
          <thead><tr>
            <th data-key="imei">IMEI</th>
            <th data-key="model">Модель</th>
            <th data-key="owner">Власник партії</th>
            <th data-key="store">Магазин (партія)</th>
            <th data-key="receiptCount">Оприбуткувань</th>
            <th data-key="repairCount">Ремонтів</th>
            <th data-key="claimCount">Звернень</th>
            <th data-key="saleDate">Дата продажу</th>
            <th data-key="lastSaleDate">Останній продаж</th>
            <th data-key="firstClaimDate">Дата повернення</th>
            <th data-key="daysSaleToReturn">Днів продаж→повернення</th>
            <th data-key="repairMasters">Майстри ремонту</th>
            <th data-key="reasons">Причини</th>
          </tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>

    <div class="section">
      <h2>Статистика по власниках партій</h2>
      <div class="table-wrap">
        <table id="table-owners">
          <thead><tr>
            <th data-key="owner">Власник</th>
            <th data-key="total">К-сть IMEI</th>
            <th data-key="repairs">Ремонтів усього</th>
            <th data-key="claims">Звернень усього</th>
            <th data-key="problemRate">% проблемних IMEI</th>
          </tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>

    <div class="section">
      <h2>Статистика по майстрах ремонту</h2>
      <div class="table-wrap">
        <table id="table-masters">
          <thead><tr>
            <th data-key="master">Майстер</th>
            <th data-key="repairs">К-сть ремонтів</th>
            <th data-key="repeatsAfter">Повторні звернення після</th>
            <th data-key="repeatRate">% повторних</th>
            <th data-key="avgDaysClaimToRepair">Сер. днів звернення→ремонт</th>
            <th data-key="topModels">Топ моделі</th>
          </tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  `;

  renderImeiTable(imeis);
  renderOwnersTable(owners);
  renderMastersTable(masters);

  document.getElementById("search-imei").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = q
      ? imeis.filter((r) =>
          r.imei.toLowerCase().includes(q) ||
          (r.model || "").toLowerCase().includes(q) ||
          (r.owner || "").toLowerCase().includes(q) ||
          (r.store || "").toLowerCase().includes(q) ||
          r.repairMasters.join(" ").toLowerCase().includes(q) ||
          r.reasons.join(" ").toLowerCase().includes(q)
        )
      : imeis;
    renderImeiTable(filtered);
  });
}

function renderSummary(records, imeis) {
  const totalRepairs = imeis.reduce((s, r) => s + r.repairCount, 0);
  const totalClaims = imeis.reduce((s, r) => s + r.claimCount, 0);
  const problemCount = imeis.filter((r) => r.problem).length;
  const avgDaysToReturn = average(imeis.map((r) => r.daysSaleToReturn).filter((v) => v !== null));

  summaryEl.innerHTML = `
    <div class="kpi"><div class="kpi-value">${records.length}</div><div class="kpi-label">Записів (звернень)</div></div>
    <div class="kpi"><div class="kpi-value">${imeis.length}</div><div class="kpi-label">Унікальних IMEI</div></div>
    <div class="kpi"><div class="kpi-value">${totalRepairs}</div><div class="kpi-label">Ремонтів усього</div></div>
    <div class="kpi"><div class="kpi-value">${totalClaims}</div><div class="kpi-label">Звернень (повернень) усього</div></div>
    <div class="kpi"><div class="kpi-value">${problemCount}</div><div class="kpi-label">Проблемних IMEI</div></div>
    <div class="kpi"><div class="kpi-value">${fmtNum(avgDaysToReturn)}</div><div class="kpi-label">Сер. днів продаж→повернення</div></div>
  `;
}

function renderImeiTable(imeis) {
  const tbody = document.querySelector("#table-imei tbody");
  tbody.innerHTML = imeis.map((r) => `
    <tr class="${r.problem ? "problem" : ""}">
      <td>${escapeHtml(r.imei)}</td>
      <td>${escapeHtml(r.model)}${r.memory ? " " + escapeHtml(r.memory) : ""}${r.color ? " " + escapeHtml(r.color) : ""}</td>
      <td>${escapeHtml(r.owner)}</td>
      <td>${escapeHtml(r.store)}</td>
      <td>${r.receiptCount}</td>
      <td>${r.repairCount}</td>
      <td>${r.claimCount}</td>
      <td>${fmtDate(r.saleDate)}</td>
      <td>${fmtDate(r.lastSaleDate)}</td>
      <td>${fmtDate(r.firstClaimDate)}</td>
      <td>${r.daysSaleToReturn ?? "—"}</td>
      <td>${escapeHtml(r.repairMasters.join(", "))}</td>
      <td>${escapeHtml(r.reasons.join("; "))}</td>
    </tr>
  `).join("");
}

function renderOwnersTable(owners) {
  const tbody = document.querySelector("#table-owners tbody");
  tbody.innerHTML = owners.map((o) => `
    <tr>
      <td>${escapeHtml(o.owner)}</td>
      <td>${o.total}</td>
      <td>${o.repairs}</td>
      <td>${o.claims}</td>
      <td>${fmtNum(o.problemRate)}%</td>
    </tr>
  `).join("");
}

function renderMastersTable(masters) {
  const tbody = document.querySelector("#table-masters tbody");
  tbody.innerHTML = masters.map((m) => `
    <tr>
      <td>${escapeHtml(m.master)}</td>
      <td>${m.repairs}</td>
      <td>${m.repeatsAfter}</td>
      <td>${fmtNum(m.repeatRate)}%</td>
      <td>${fmtNum(m.avgDaysClaimToRepair)}</td>
      <td>${escapeHtml(m.byModel.slice(0, 3).map(([model, count]) => `${model} (${count})`).join(", "))}</td>
    </tr>
  `).join("");
}

/* ─── Sorting ─── */
document.addEventListener("click", (e) => {
  const th = e.target.closest("th[data-key]");
  if (!th) return;
  const table = th.closest("table");
  const key = th.dataset.key;
  const tbody = table.querySelector("tbody");
  const rows = [...tbody.querySelectorAll("tr")];
  const idx = [...th.parentElement.children].indexOf(th);
  const asc = th.dataset.asc !== "true";
  th.dataset.asc = asc;
  rows.sort((a, b) => {
    const av = a.children[idx].textContent.trim();
    const bv = b.children[idx].textContent.trim();
    const an = parseFloat(av.replace(",", "."));
    const bn = parseFloat(bv.replace(",", "."));
    let cmp;
    if (!Number.isNaN(an) && !Number.isNaN(bn) && /^[\d.,%-]+$/.test(av) && /^[\d.,%-]+$/.test(bv)) {
      cmp = an - bn;
    } else {
      cmp = av.localeCompare(bv, "uk");
    }
    return asc ? cmp : -cmp;
  });
  rows.forEach((r) => tbody.appendChild(r));
});
