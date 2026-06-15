// Вкладка "Власники партій": рейтинг власників за проблемністю.

const TabOwners = {
  render(container, { imeiAgg }) {
    const owners = aggregateByOwner(imeiAgg);

    container.innerHTML = `
      <h2>Власники партій</h2>
      <p class="hint">Сортовано від найбільш до найменш проблемних (% проблемних IMEI).</p>
      <table class="data-table" id="owners-table">
        <thead>
          <tr>
            <th data-key="owner" title="Юридична/фізична особа або джерело, що поставило партію товару (Trade-in, постачальник тощо).">Власник партії</th>
            <th data-key="total" title="Кількість унікальних IMEI, що належать цьому власнику партії.">К-сть IMEI</th>
            <th data-key="repairs" title="Сумарна кількість ремонтів усіх IMEI цього власника.">Ремонтів</th>
            <th data-key="claims" title="Сумарна кількість повторних звернень (повернень) усіх IMEI цього власника.">Звернень</th>
            <th data-key="avgRepairs" title="Кількість ремонтів, поділена на кількість IMEI цього власника.">Сер. ремонтів / IMEI</th>
            <th data-key="avgReturn" title="Середня кількість днів між продажем і першим зверненням для IMEI цього власника.">Сер. дн. продаж→повернення</th>
            <th data-key="problemRate" title="Частка IMEI цього власника, які класифіковано як проблемні (2+ ремонти/звернення, повторна причина або 2+ обміни).">% проблемних IMEI</th>
            <th title="3 моделі, які найчастіше зустрічаються серед IMEI цього власника.">ТОП моделі</th>
          </tr>
        </thead>
        <tbody>
          ${owners.map((o) => `
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
          `).join("")}
        </tbody>
      </table>
    `;

    enableTableSort(container.querySelector("#owners-table"));
  }
};
