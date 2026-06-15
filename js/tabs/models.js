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
            <th data-key="model" title="Бренд і назва моделі пристрою.">Модель</th>
            <th data-key="total" title="Кількість унікальних IMEI цієї моделі у вибірці.">К-сть IMEI</th>
            <th data-key="repairs" title="Сумарна кількість ремонтів усіх IMEI цієї моделі.">Ремонтів</th>
            <th data-key="claims" title="Сумарна кількість повторних звернень (повернень) усіх IMEI цієї моделі.">Звернень</th>
            <th data-key="avgRepairs" title="Кількість ремонтів, поділена на кількість IMEI цієї моделі.">Сер. ремонтів / IMEI</th>
            <th data-key="avgReturn" title="Середня кількість днів між продажем і першим зверненням для IMEI цієї моделі.">Сер. дн. продаж→повернення</th>
            <th data-key="problemRate" title="Частка IMEI цієї моделі, які класифіковано як проблемні (2+ ремонти/звернення, повторна причина або 2+ обміни).">% проблемних IMEI</th>
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
