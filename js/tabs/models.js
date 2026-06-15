// Вкладка "Моделі": статистика та рейтинг проблемності по моделях.

const TabModels = {
  render(container, { imeiAgg }) {
    const models = aggregateByModel(imeiAgg);

    container.innerHTML = `
      <h2>Моделі</h2>
      <p class="hint">Сортовано від найбільш до найменш проблемних (% проблемних IMEI).</p>
      <table class="data-table" id="models-table">
        <thead>
          <tr>
            <th data-key="model">Модель</th>
            <th data-key="total">К-сть IMEI</th>
            <th data-key="repairs">Ремонтів</th>
            <th data-key="claims">Звернень</th>
            <th data-key="avgRepairs">Сер. ремонтів / IMEI</th>
            <th data-key="avgReturn">Сер. дн. продаж→повернення</th>
            <th data-key="problemRate">% проблемних IMEI</th>
          </tr>
        </thead>
        <tbody>
          ${models.map((m) => `
            <tr>
              <td data-sort="${escapeHtml(m.model)}">${escapeHtml(m.model)}</td>
              <td data-sort="${m.total}">${m.total}</td>
              <td data-sort="${m.repairs}">${m.repairs}</td>
              <td data-sort="${m.claims}">${m.claims}</td>
              <td data-sort="${m.avgRepairsPerImei}">${fmtNum(m.avgRepairsPerImei, 2)}</td>
              <td data-sort="${m.avgDaysSaleToReturn ?? -1}">${m.avgDaysSaleToReturn !== null ? fmtNum(m.avgDaysSaleToReturn, 0) : "—"}</td>
              <td data-sort="${m.problemRate}" class="${levelClass(m.problemRate, 15, 30)}">${fmtPercent(m.problemRate)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    enableTableSort(container.querySelector("#models-table"));
  }
};
