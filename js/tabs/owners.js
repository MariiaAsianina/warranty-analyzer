// Вкладка "Власники партій": рейтинг власників за проблемністю.

const TabOwners = {
  searchQuery: "",
  minImei: 0,

  render(container, { imeiAgg }) {
    this.owners = aggregateByOwner(imeiAgg);

    container.innerHTML = `
      <h2>Власники партій</h2>
      <p class="hint">Сортовано від найбільш до найменш проблемних (% проблемних IMEI).</p>
      <div class="details-toolbar">
        <input type="text" id="owners-search" class="input" placeholder="Пошук за назвою власника..." value="${escapeHtml(this.searchQuery)}">
        <select id="owners-min-imei" class="input" title="Показати лише власників, у яких к-сть IMEI не менша за обране значення. Допомагає уникнути перекосу, коли власник з 2-3 IMEI здається 'найпроблемнішим' лише через малу вибірку.">
          <option value="0">Усі власники</option>
          <option value="2">2+ IMEI</option>
          <option value="5">5+ IMEI</option>
          <option value="10">10+ IMEI</option>
        </select>
      </div>
      <table class="data-table" id="owners-table">
        <thead>
          <tr>
            <th data-key="owner" title="Юридична/фізична особа або джерело, що поставило партію товару (Trade-in, постачальник тощо).">Власник партії</th>
            <th data-key="total" title="Кількість унікальних IMEI, що належать цьому власнику партії.">К-сть IMEI</th>
            <th data-key="repairs" title="Сумарна кількість ремонтів усіх IMEI цього власника.">Ремонтів</th>
            <th data-key="claims" title="Сумарна кількість повторних звернень (повернень) усіх IMEI цього власника.">Звернень</th>
            <th data-key="avgRepairs" title="Кількість ремонтів, поділена на кількість IMEI цього власника.">Сер. ремонтів / IMEI</th>
            <th data-key="avgReturn" title="Середня кількість днів між продажем і першим зверненням для IMEI цього власника.">Сер. дн. продаж→повернення</th>
            <th data-key="problemRate" title="Частка IMEI цього власника, які класифіковано як проблемні (2+ ремонти, 2+ звернення або повторна причина звернення).">% проблемних IMEI</th>
            <th title="3 моделі, які найчастіше зустрічаються серед IMEI цього власника.">ТОП моделі</th>
          </tr>
        </thead>
        <tbody id="owners-tbody"></tbody>
      </table>
    `;

    const table = container.querySelector("#owners-table");
    const tbody = container.querySelector("#owners-tbody");
    const searchInput = container.querySelector("#owners-search");
    const minImeiSelect = container.querySelector("#owners-min-imei");
    minImeiSelect.value = String(this.minImei);

    this.renderRows(tbody);
    enableTableSort(table);

    searchInput.addEventListener("input", () => {
      this.searchQuery = searchInput.value;
      this.renderRows(tbody);
    });

    minImeiSelect.addEventListener("change", () => {
      this.minImei = Number(minImeiSelect.value);
      this.renderRows(tbody);
    });
  },

  renderRows(tbody) {
    const q = this.searchQuery.trim().toLowerCase();
    const filtered = this.owners.filter((o) => {
      if (o.total < this.minImei) return false;
      if (q && !o.owner.toLowerCase().includes(q)) return false;
      return true;
    });

    tbody.innerHTML = filtered.map((o) => `
      <tr>
        <td data-sort="${escapeHtml(o.owner)}">${escapeHtml(o.owner)}</td>
        <td data-sort="${o.total}">${o.total}</td>
        <td data-sort="${o.repairs}">${o.repairs}</td>
        <td data-sort="${o.claims}">${o.claims}</td>
        <td data-sort="${o.avgRepairsPerImei}">${fmtNum(o.avgRepairsPerImei, 2)}</td>
        <td data-sort="${o.avgDaysSaleToReturn ?? -1}">${o.avgDaysSaleToReturn !== null ? fmtNum(o.avgDaysSaleToReturn, 0) : "—"}</td>
        <td data-sort="${o.problemRate}" class="${levelClass(o.problemRate, 15, 30)}">${fmtPercent(o.problemRate)}</td>
        <td>${o.topModels.map((m) => escapeHtml(m.key)).join(", ") || "—"}</td>
      </tr>
    `).join("");
  }
};
