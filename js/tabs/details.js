// Вкладка "Деталізація": повна таблиця записів з пошуком, сортуванням та експортом.

const TabDetails = {
  columns: [
    { key: "imei", label: "IMEI" },
    { key: "modelLabel", label: "Модель" },
    { key: "memory", label: "Пам'ять" },
    { key: "color", label: "Колір" },
    { key: "owner", label: "Власник партії" },
    { key: "store", label: "Магазин" },
    { key: "city", label: "Місто" },
    { key: "reason", label: "Причина" },
    { key: "date", label: "Дата звернення" },
    { key: "saleDate", label: "Дата продажу" },
    { key: "repairMastersStr", label: "Майстри ремонту" },
    { key: "repairCount", label: "Ремонтів" },
    { key: "claimCount", label: "Звернень" },
    { key: "receiptCount", label: "Оприбуткувань" },
    { key: "status", label: "Статус" }
  ],

  render(container, { records }) {
    const rows = records.map((r) => ({
      ...r,
      modelLabel: `${r.brand || ""} ${r.model || ""}`.trim() || "Невідома модель",
      repairMastersStr: (r.repairMasters || []).join(", ")
    }));

    container.innerHTML = `
      <h2>Деталізація</h2>
      <div class="details-toolbar">
        <input type="text" id="details-search" class="input" placeholder="Пошук по таблиці...">
        <button id="details-export" class="btn">Експорт CSV</button>
      </div>
      <div class="table-scroll">
        <table class="data-table sticky" id="details-table">
          <thead>
            <tr>
              ${this.columns.map((c) => `<th data-key="${c.key}">${escapeHtml(c.label)}</th>`).join("")}
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
