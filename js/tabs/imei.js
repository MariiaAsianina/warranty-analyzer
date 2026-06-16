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
        ${summaryItem("Модель", r.modelLabel, "", "Бренд і назва моделі пристрою.")}
        ${summaryItem("Пам'ять / колір", `${r.memory || "—"} ${r.color || ""}`.trim(), "", "Обсяг пам'яті та колір корпусу.")}
        ${summaryItem("Власник партії", r.owner || "Невідомо", "", "Джерело партії товару (Trade-in, постачальник тощо).")}
        ${summaryItem("Магазин", r.store || "—", "", "Склад/магазин першого оприбуткування цього IMEI.")}
        ${summaryItem("Місто", r.city || "—", "", "Місто магазину/складу.")}
        ${summaryItem("Дата продажу", fmtDate(r.saleDate), "", "Дата найранішого продажу (чек ККМ) цього IMEI.")}
        ${summaryItem("Дата першого звернення", fmtDate(r.firstClaimDate), "", "Дата першого оприбуткування, що сталось після продажу (перше звернення клієнта).")}
        ${summaryItem("Дата останнього звернення", fmtDate(r.lastClaimDate), "", "Дата останнього оприбуткування, що сталось після продажу (останнє звернення клієнта).")}
        ${summaryItem("К-сть обмінів", r.exchangeCount, "", "Кількість записів-обмінів (характеристик IMEI) у звітах 1С для цього пристрою.")}
        ${summaryItem("Днів продаж → повернення", r.daysSaleToReturn ?? "—", levelClass(r.daysSaleToReturn ?? -1, 30, 7, true), "Кількість днів між продажем і першим зверненням. Менше значення = пристрій повернули швидше, що може вказувати на серйознішу проблему.")}
        ${summaryItem("Оприбуткувань усього", r.receiptCount, "", "Загальна кількість подій 'Оприбуткування запасів' для цього IMEI.")}
        ${summaryItem("Оприбуткувань після продажу", r.receiptsAfterSale, levelClass(r.receiptsAfterSale, 1, 2), "Кількість оприбуткувань, що сталися після продажу (дата > дата продажу) — повернення клієнтом. Кожне таке оприбуткування = нове звернення клієнта.")}
        ${summaryItem("Оприбуткувань після ремонту", r.receiptsAfterRepair, levelClass(r.receiptsAfterRepair, 1, 2), "Кількість оприбуткувань, що сталися одразу після ремонту (виробництва) — повернення пристрою на склад після ремонтних робіт, а не повернення від клієнта.")}
        ${summaryItem("Ремонтів", r.repairCount, levelClass(r.repairCount, 1, 2), "Кількість подій 'Виробництво' (фактичних ремонтів) для цього IMEI.")}
        ${summaryItem("Сер. днів між ремонтами", fmtNum(r.avgDaysBetweenRepairs, 0), "", "Середній інтервал у днях між послідовними ремонтами цього IMEI.")}
        ${summaryItem("Майстри ремонту", r.repairMasters.length ? r.repairMasters.join(", ") : "—", "", "Усі майстри, які ремонтували цей IMEI.")}
        ${summaryItem("Причини", r.reasons.length ? r.reasons.join(", ") : "—", "", "Усі унікальні причини звернень по цьому IMEI.")}
        ${summaryItem("Статус", r.problem ? badge("Проблемний", "bad") : badge("Без проблем", "good"), "", "IMEI вважається проблемним, якщо має 2+ ремонти, 2+ звернення (повернення після продажу) або повторну причину звернення.")}
      </div>

      <h3>Хронологія подій</h3>
      <p class="hint">Усі документи 1С по цьому IMEI у хронологічному порядку: продажі, оприбуткування (звернення), ремонти, списання, переміщення.</p>
      <table class="timeline-table">
        <thead><tr>
          <th title="Дата документа.">Дата</th>
          <th title="Тип документа/події: Продаж, Оприбуткування, Ремонт, Списання, Переміщення.">Тип</th>
          <th title="Для оприбуткувань: після продажу (звернення клієнта), після ремонту (повернення на склад) або первинне.">Деталь оприбуткування</th>
          <th title="Номер документа в 1С.">Документ</th>
          <th title="Склад/магазин, де відбулась подія.">Склад</th>
          <th title="Майстер, що виконував ремонт (лише для подій 'Ремонт').">Майстер</th>
          <th title="Вартість ремонту або собівартість на момент події.">Вартість</th>
        </tr></thead>
        <tbody>
          ${r.events.map((e) => `
            <tr>
              <td>${fmtDate(e.date)}</td>
              <td>${eventTypeLabel(e.type)}</td>
              <td>${e.type === "receipt" ? receiptKindBadge(e.receiptKind) : ""}</td>
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

function receiptKindBadge(kind) {
  if (kind === "claim")      return badge("Після продажу", "bad");
  if (kind === "afterRepair") return badge("Після ремонту", "warn");
  return badge("Первинне", "good");
}

function summaryItem(label, value, level = "", desc = "") {
  const title = desc ? ` title="${escapeHtml(desc)}"` : "";
  return `<div class="summary-item"${title}><div class="summary-label">${escapeHtml(label)}</div><div class="summary-value ${level}">${value}</div></div>`;
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
