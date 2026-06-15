// Вкладка "Моделі": статистика та рейтинг проблемності по моделях.

const TabModels = {
  minImei: MIN_SAMPLE,

  render(container, { imeiAgg }) {
    this.models = aggregateByModel(imeiAgg);

    container.innerHTML = `
      <h2>Моделі</h2>
      <p class="hint">Сортовано від найбільш до найменш проблемних (% проблемних IMEI). Моделі з малою к-стю IMEI приховані за замовчуванням, щоб уникнути викривлення через малу вибірку.</p>
      <div class="details-toolbar">
        <select id="models-min-imei" class="input" title="Показати лише моделі, у яких к-сть IMEI не менша за обране значення.">
          <option value="0">Усі моделі</option>
          <option value="2">2+ IMEI</option>
          <option value="5">5+ IMEI</option>
          <option value="10">10+ IMEI</option>
        </select>
      </div>
      <table class="data-table" id="models-table">
        <thead>
          <tr>
            <th data-key="model" title="Бренд і назва моделі пристрою.">Модель</th>
            <th data-key="total" title="Кількість унікальних IMEI цієї моделі у вибірці.">К-сть IMEI</th>
            <th data-key="repairs" title="Сумарна кількість ремонтів усіх IMEI цієї моделі.">Ремонтів</th>
            <th data-key="claims" title="Сумарна кількість повторних звернень (повернень) усіх IMEI цієї моделі.">Звернень</th>
            <th data-key="avgRepairs" title="Кількість ремонтів, поділена на кількість IMEI цієї моделі.">Сер. ремонтів / IMEI</th>
            <th data-key="avgReturn" title="Середня кількість днів між продажем і першим зверненням для IMEI цієї моделі.">Сер. дн. продаж→повернення</th>
            <th data-key="problemRate" title="Частка IMEI цієї моделі, які класифіковано як проблемні (2+ ремонти, 2+ звернення або повторна причина звернення).">% проблемних IMEI</th>
          </tr>
        </thead>
        <tbody id="models-tbody"></tbody>
      </table>
    `;

    const table = container.querySelector("#models-table");
    const tbody = container.querySelector("#models-tbody");
    const minSelect = container.querySelector("#models-min-imei");
    minSelect.value = String(this.minImei);

    this.renderRows(tbody);
    enableTableSort(table);

    minSelect.addEventListener("change", () => {
      this.minImei = Number(minSelect.value);
      this.renderRows(tbody);
    });
  },

  renderRows(tbody) {
    const models = this.models.filter((m) => m.total >= this.minImei);
    tbody.innerHTML = models.map((m) => `
      <tr>
        <td data-sort="${escapeHtml(m.model)}">${escapeHtml(m.model)}</td>
        <td data-sort="${m.total}">${m.total}</td>
        <td data-sort="${m.repairs}">${m.repairs}</td>
        <td data-sort="${m.claims}">${m.claims}</td>
        <td data-sort="${m.avgRepairsPerImei}">${fmtNum(m.avgRepairsPerImei, 2)}</td>
        <td data-sort="${m.avgDaysSaleToReturn ?? -1}">${m.avgDaysSaleToReturn !== null ? fmtNum(m.avgDaysSaleToReturn, 0) : "—"}</td>
        <td data-sort="${m.problemRate}" class="${levelClass(m.problemRate, 15, 30)}">${fmtPercent(m.problemRate)}</td>
      </tr>
    `).join("");
  }
};
