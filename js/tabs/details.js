// Вкладка "Деталізація": повна таблиця записів з пошуком, сортуванням та експортом.

const TabDetails = {
  columns: [
    { key: "imei", label: "IMEI", desc: "Унікальний серійний номер пристрою." },
    { key: "modelLabel", label: "Модель", desc: "Бренд і назва моделі пристрою." },
    { key: "memory", label: "Пам'ять", desc: "Обсяг вбудованої пам'яті." },
    { key: "color", label: "Колір", desc: "Колір корпусу пристрою." },
    { key: "owner", label: "Власник партії", desc: "Джерело партії товару (Trade-in, постачальник тощо)." },
    { key: "store", label: "Магазин", desc: "Склад/магазин, з якого було оприбуткування." },
    { key: "city", label: "Місто", desc: "Місто магазину/складу." },
    { key: "reason", label: "Причина", desc: "Причина звернення/обміну за записом." },
    { key: "date", label: "Дата звернення", desc: "Дата запису (звернення/обміну), яку можна редагувати вручну." },
    { key: "saleDate", label: "Дата продажу", desc: "Дата продажу пристрою (чек ККМ)." },
    { key: "repairMastersStr", label: "Майстри ремонту", desc: "Майстри, що виконували ремонт цього IMEI." },
    { key: "repairCount", label: "Ремонтів", desc: "Кількість подій 'Виробництво' (ремонт) для цього IMEI." },
    { key: "claimCount", label: "Звернень", desc: "Кількість повторних оприбуткувань (повернень) після продажу." },
    { key: "receiptCount", label: "Оприбуткувань", desc: "Загальна кількість подій 'Оприбуткування' для цього IMEI." },
    { key: "status", label: "Статус", desc: "Статус обробки запису (за замовчуванням 'Завершено')." }
  ],

  render(container, { records }) {
    const rows = records.map((r) => ({
      ...r,
      modelLabel: `${r.brand || ""} ${r.model || ""}`.trim() || "Невідома модель",
      repairMastersStr: (r.repairMasters || []).join(", ")
    }));

    container.innerHTML = `
      <h2>Деталізація</h2>
      <p class="hint">Повна таблиця всіх записів (звернень/обмінів) з 1С-звіту. Наведіть курсор на заголовок колонки, щоб побачити її опис.</p>
      <div class="details-toolbar">
        <input type="text" id="details-search" class="input" placeholder="Пошук по таблиці...">
        <button id="details-export" class="btn">Експорт CSV</button>
      </div>
      <div class="table-scroll">
        <table class="data-table sticky" id="details-table">
          <thead>
            <tr>
              ${this.columns.map((c) => `<th data-key="${c.key}" title="${escapeHtml(c.desc)}">${escapeHtml(c.label)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.map((r) => this.renderRow(r)).join("")}
          </tbody>
        </table>
      </div>
    `;

    const table = container.querySelector("#details-table");
    enableTableSort(table);

    const searchInput = container.querySelector("#details-search");
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.trim().toLowerCase();
      table.querySelectorAll("tbody tr").forEach((tr) => {
        tr.style.display = !q || tr.textContent.toLowerCase().includes(q) ? "" : "none";
      });
    });

    container.querySelector("#details-export").addEventListener("click", () => {
      const header = this.columns.map((c) => c.label);
      const csvRows = [header, ...rows.map((r) => this.columns.map((c) => r[c.key] ?? ""))];
      downloadCsv("деталізація.csv", csvRows);
    });
  },

  renderRow(r) {
    return `
      <tr>
        ${this.columns.map((c) => {
          let value = r[c.key];
          let sortValue = value;
          if (c.key === "date" || c.key === "saleDate") value = fmtDate(value);
          if (value === null || value === undefined || value === "") value = "—";
          return `<td data-sort="${escapeHtml(sortValue ?? "")}">${escapeHtml(value)}</td>`;
        }).join("")}
      </tr>
    `;
  }
};
