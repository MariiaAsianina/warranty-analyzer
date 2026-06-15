// Вкладка "Причини": ТОП причин, Pareto, теплові карти, динаміка.

const TabReasons = {
  render(container, { records }) {
    const reasonKey = (r) => r.reason || "Невідомо";
    const modelKey = (r) => `${r.brand || ""} ${r.model || ""}`.trim() || "Невідома модель";
    const storeKey = (r) => r.store || "Невідомо";

    const reasons = aggregateByReason(records);
    const pareto = paretoSeries(records, reasonKey, 12);
    const storeHeatmap = crossTab(records, storeKey, reasonKey, 10, 8);
    const modelHeatmap = crossTab(records, modelKey, reasonKey, 10, 8);

    const topReasons = reasons.slice(0, 5).map((r) => r.reason);
    const months = [...new Set(monthlySeries(records, (r) => r.date).map((m) => m.month))];
    const trendDatasets = topReasons.map((reason) => {
      const sub = records.filter((r) => (r.reason || "Невідомо") === reason);
      const series = monthlySeries(sub, (r) => r.date);
      const map = new Map(series.map((s) => [s.month, s.count]));
      return { label: reason, data: months.map((m) => map.get(m) || 0) };
    });

    container.innerHTML = `
      <h2>Причини звернень</h2>

      <h3>ТОП причин</h3>
      <p class="hint">Кожен запис у звіті має причину звернення (поле "Причина обміну"). Таблиця показує, які причини зустрічаються найчастіше.</p>
      <table class="data-table" id="reasons-table">
        <thead>
          <tr>
            <th data-key="reason" title="Текст причини звернення/обміну з 1С-звіту.">Причина</th>
            <th data-key="count" title="Кількість записів (звернень) з цією причиною.">К-сть</th>
            <th data-key="percent" title="Частка цієї причини серед усіх звернень у вибірці.">% від усіх</th>
            <th data-key="repairs" title="Сумарна кількість ремонтів по записах з цією причиною.">Ремонтів</th>
          </tr>
        </thead>
        <tbody>
          ${reasons.map((r) => `
            <tr>
              <td data-sort="${escapeHtml(r.reason)}">${escapeHtml(r.reason)}</td>
              <td data-sort="${r.count}">${r.count}</td>
              <td data-sort="${r.percent}">${fmtPercent(r.percent)}</td>
              <td data-sort="${r.repairs}">${r.repairs}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <div class="charts-grid">
        <div class="chart-card">
          <h3>Pareto-аналіз причин</h3>
          <p class="hint">Стовпці — кількість звернень по причині, лінія — накопичувальний відсоток. Показує, які причини дають основну масу звернень (правило 80/20).</p>
          <div class="chart-wrap"><canvas id="reasons-pareto"></canvas></div>
        </div>
        <div class="chart-card">
          <h3>Динаміка ТОП-5 причин по місяцях</h3>
          <p class="hint">Кількість звернень по кожній з 5 найпоширеніших причин у розрізі місяців.</p>
          <div class="chart-wrap"><canvas id="reasons-trend"></canvas></div>
        </div>
      </div>

      <h3>Теплова карта: Магазин × Причина</h3>
      <p class="hint">Кількість звернень по кожній парі "магазин (склад оприбуткування) — причина". Темніший колір = більше звернень.</p>
      <div id="store-reason-heatmap"></div>

      <h3>Теплова карта: Модель × Причина</h3>
      <p class="hint">Кількість звернень по кожній парі "модель пристрою — причина". Темніший колір = більше звернень.</p>
      <div id="model-reason-heatmap"></div>
    `;

    enableTableSort(container.querySelector("#reasons-table"));

    paretoChart(
      document.getElementById("reasons-pareto"),
      pareto.map((p) => p.key),
      pareto.map((p) => p.count),
      pareto.map((p) => p.cumPercent)
    );

    lineChart(document.getElementById("reasons-trend"), months, trendDatasets);

    renderHeatmap(document.getElementById("store-reason-heatmap"), storeHeatmap, "Магазин \\ Причина");
    renderHeatmap(document.getElementById("model-reason-heatmap"), modelHeatmap, "Модель \\ Причина");
  }
};
