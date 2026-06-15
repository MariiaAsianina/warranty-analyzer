// Вкладка "IMEI": пошук та повна історія по конкретному IMEI.

const TabImei = {
  selectedImei: null,

  render(container, { imeiAgg }) {
    if (this.selectedImei && !imeiAgg.some((r) => r.imei === this.selectedImei)) {
      this.selectedImei = null;
    }

    container.innerHTML = `
      <div class="imei-tab">
        <div class="imei-list-panel">
          <input type="text" id="imei-search" class="input" placeholder="Пошук за IMEI..." value="${escapeHtml(this.searchQuery || "")}">
          <div class="imei-list" id="imei-list"></div>
        </div>
        <div class="imei-detail-panel" id="imei-detail"></div>
      </div>
    `;

    const searchInput = container.querySelector("#imei-search");
    searchInput.addEventListener("input", () => {
      this.searchQuery = searchInput.value;
      this.renderList(imeiAgg);
    });

    this.renderList(imeiAgg);
    this.renderDetail(imeiAgg);
  },

  renderList(imeiAgg) {
    const listEl = document.getElementById("imei-list");
    const q = (this.searchQuery || "").trim().toLowerCase();
    const filtered = q ? imeiAgg.filter((r) => r.imei.toLowerCase().includes(q)) : imeiAgg;

    if (!filtered.length) {
      listEl.innerHTML = `<div class="empty-hint">Нічого не знайдено</div>`;
      return;
    }

    listEl.innerHTML = filtered.slice(0, 200).map((r) => {
      const active = r.imei === this.selectedImei ? "active" : "";
      const level = r.problem ? "bad" : "good";
      return `
        <div class="imei-list-item ${active}" data-imei="${escapeHtml(r.imei)}">
          <div class="imei-list-item-main">
            <span class="badge ${level}">${r.repairCount + r.claimCount}</span>
            <div>
              <div class="imei-list-item-id">${escapeHtml(r.imei)}</div>
              <div class="imei-list-item-model">${escapeHtml(r.modelLabel)}</div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    listEl.querySelectorAll(".imei-list-item").forEach((node) => {
      node.addEventListener("click", () => {
        this.selectedImei = node.dataset.imei;
        this.renderList(imeiAgg);
        this.renderDetail(imeiAgg);
      });
    });
  },

  renderDetail(imeiAgg) {
    const detailEl = document.getElementById("imei-detail");
    const r = imeiAgg.find((x) => x.imei === this.selectedImei);

    if (!r) {
      detailEl.innerHTML = `<div class="empty-hint">Виберіть IMEI зі списку зліва, щоб побачити повну історію.</div>`;
      return;
    }

    detailEl.innerHTML = `
      <h2>${escapeHtml(r.imei)}</h2>
      <div class="imei-summary-grid">
        ${summaryItem("Модель", r.modelLabel)}
        ${summaryItem("Пам'ять / колір", `${r.memory || "—"} ${r.color || ""}`.trim())}
        ${summaryItem("Власник партії", r.owner || "Невідомо")}
        ${summaryItem("Магазин", r.store || "—")}
        ${summaryItem("Місто", r.city || "—")}
        ${summaryItem("Дата продажу", fmtDate(r.saleDate))}
        ${summaryItem("Дата першого повернення", fmtDate(r.firstClaimDate))}
        ${summaryItem("Днів продаж → повернення", r.daysSaleToReturn ?? "—", levelClass(r.daysSaleToReturn ?? -1, 30, 7, true))}
        ${summaryItem("Оприбуткувань (звернень)", r.receiptCount)}
        ${summaryItem("Звернень (claims)", r.claimCount, levelClass(r.claimCount, 1, 2))}
        ${summaryItem("Ремонтів", r.repairCount, levelClass(r.repairCount, 1, 2))}
        ${summaryItem("Сер. днів між ремонтами", fmtNum(r.avgDaysBetweenRepairs, 0))}
        ${summaryItem("Майстри ремонту", r.repairMasters.length ? r.repairMasters.join(", ") : "—")}
        ${summaryItem("Причини", r.reasons.length ? r.reasons.join(", ") : "—")}
        ${summaryItem("Статус", r.problem ? badge("Проблемний", "bad") : badge("Без проблем", "good"))}
      </div>

      <h3>Хронологія подій</h3>
      <table class="timeline-table">
        <thead><tr><th>Дата</th><th>Тип</th><th>Документ</th><th>Склад</th><th>Майстер</th><th>Вартість</th></tr></thead>
        <tbody>
          ${r.events.map((e) => `
            <tr>
              <td>${fmtDate(e.date)}</td>
              <td>${eventTypeLabel(e.type)}</td>
              <td>${escapeHtml(e.docNumber || "—")}</td>
              <td>${escapeHtml(e.warehouse || "—")}</td>
              <td>${escapeHtml(e.repairMaster || "—")}</td>
              <td>${e.repairCost != null ? e.repairCost : (e.costValue != null ? e.costValue : "—")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }
};

function summaryItem(label, value, level = "") {
  return `<div class="summary-item"><div class="summary-label">${escapeHtml(label)}</div><div class="summary-value ${level}">${value}</div></div>`;
}

function eventTypeLabel(type) {
  const map = {
    sale: "Продаж",
    receipt: "Оприбуткування",
    production: "Ремонт",
    writeoff: "Списання",
    transferIn: "Переміщення (вх.)",
    transferOut: "Переміщення (вих.)"
  };
  return escapeHtml(map[type] || type);
}
