// Вкладка "Майстри": статистика по майстрах ремонту з кольоровими індикаторами.

const TabMasters = {
  minRepairs: MASTER_MIN_REPAIRS,

  render(container, { imeiAgg }) {
    this.masters = aggregateByMaster(imeiAgg);

    container.innerHTML = `
      <h2>Майстри ремонту</h2>
      <p class="hint">
        ${badge("Добре", "good")} — низький % повторних звернень,
        ${badge("Середньо", "warn")} — помірний,
        ${badge("Проблема", "bad")} — високий % повторних звернень після ремонту.
        Майстри з малою к-стю ремонтів приховані за замовчуванням, щоб уникнути викривлення через малу вибірку.
      </p>
      <div class="details-toolbar">
        <select id="masters-min-repairs" class="input" title="Показати лише майстрів з не меншою к-стю ремонтів. При малій к-сті ремонтів % повторних звернень дуже нестабільний (1 випадок може дати 50-100%).">
          <option value="0">Усі майстри</option>
          <option value="2">2+ ремонти</option>
          <option value="5">5+ ремонтів</option>
          <option value="10">10+ ремонтів</option>
        </select>
      </div>
      <table class="data-table" id="masters-table">
        <thead>
          <tr>
            <th data-key="master" title="Майстер, який виконував ремонт (поле 'Майстер ремонту' у звіті).">Майстер</th>
            <th data-key="repairs" title="Кількість ремонтів, виконаних цим майстром.">К-сть ремонтів</th>
            <th data-key="repeatsAfter" title="Кількість випадків, коли після цього конкретного ремонту по тому ж IMEI сталось ще одне звернення клієнта (повернення після продажу) або ще один ремонт (тобто пристрій довелось обслуговувати знову).">Повторні звернення</th>
            <th data-key="repeatRate" title="Повторні звернення / усього ремонтів × 100%. Чим менше — тим краще якість ремонту.">% повторних</th>
            <th data-key="avgDays" title="Середня кількість днів між оприбуткуванням (зверненням клієнта) і ремонтом цим майстром.">Сер. час від звернення до ремонту, дн.</th>
            <th title="3 моделі, які майстер ремонтував найчастіше.">ТОП моделі</th>
            <th title="Список IMEI, які після ремонту цим майстром повернулись повторно.">IMEI з поверненням після ремонту</th>
          </tr>
        </thead>
        <tbody id="masters-tbody"></tbody>
      </table>
    `;

    const table = container.querySelector("#masters-table");
    const tbody = container.querySelector("#masters-tbody");
    const minSelect = container.querySelector("#masters-min-repairs");
    minSelect.value = String(this.minRepairs);

    this.renderRows(tbody);
    enableTableSort(table);

    minSelect.addEventListener("change", () => {
      this.minRepairs = Number(minSelect.value);
      this.renderRows(tbody);
    });
  },

  renderRows(tbody) {
    const masters = this.masters.filter((m) => m.repairs >= this.minRepairs);
    tbody.innerHTML = masters.map((m) => {
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
    }).join("");
  }
};
