// Вкладка "Майстри": статистика по майстрах ремонту з кольоровими індикаторами.

const TabMasters = {
  render(container, { records }) {
    const masters = aggregateByMaster(records).filter((m) => m.repairs > 0);

    container.innerHTML = `
      <h2>Майстри ремонту</h2>
      <p class="hint">
        ${badge("Добре", "good")} — низький % повторних звернень,
        ${badge("Середньо", "warn")} — помірний,
        ${badge("Проблема", "bad")} — високий % повторних звернень після ремонту.
      </p>
      <table class="data-table" id="masters-table">
        <thead>
          <tr>
            <th data-key="master" title="Майстер, який виконував ремонт (поле 'Майстер ремонту' у звіті).">Майстер</th>
            <th data-key="repairs" title="Кількість ремонтів, виконаних цим майстром.">К-сть ремонтів</th>
            <th data-key="repeatsAfter" title="Кількість випадків, коли після ремонту цього майстра по тому ж IMEI з'явилась ще одна подія оприбуткування або ремонту (тобто пристрій повернувся знову).">Повторні звернення</th>
            <th data-key="repeatRate" title="Повторні звернення / усього ремонтів × 100%. Чим менше — тим краще якість ремонту.">% повторних</th>
            <th data-key="avgDays" title="Середня кількість днів між оприбуткуванням (зверненням клієнта) і ремонтом цим майстром.">Сер. час від звернення до ремонту, дн.</th>
            <th title="3 моделі, які майстер ремонтував найчастіше.">ТОП моделі</th>
            <th title="Список IMEI, які після ремонту цим майстром повернулись повторно.">IMEI з поверненням після ремонту</th>
          </tr>
        </thead>
        <tbody>
          ${masters.map((m) => {
            const level = levelClass(m.repeatRate, 15, 30);
            return `
              <tr>
                <td data-sort="${escapeHtml(m.master)}">${escapeHtml(m.master)}</td>
                <td data-sort="${m.repairs}">${m.repairs}</td>
                <td data-sort="${m.repeatsAfter}">${m.repeatsAfter}</td>
                <td data-sort="${m.repeatRate}">${badge(fmtPercent(m.repeatRate), level)}</td>
                <td data-sort="${m.avgDaysClaimToRepair ?? -1}">${m.avgDaysClaimToRepair !== null ? fmtNum(m.avgDaysClaimToRepair, 1) : "—"}</td>
                <td>${m.byModel.slice(0, 3).map(([model, count]) => `${escapeHtml(model)} (${count})`).join(", ") || "—"}</td>
                <td class="imei-cell">${m.returnedImeis.length ? m.returnedImeis.map((i) => escapeHtml(i)).join(", ") : "—"}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;

    enableTableSort(container.querySelector("#masters-table"));
  }
};
