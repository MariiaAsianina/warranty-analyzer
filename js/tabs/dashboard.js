// Вкладка "Дашборд": KPI-картки + ключові графіки.

const TabDashboard = {
  render(container, { records, imeiAgg }) {
    const k = computeKpis(records, imeiAgg);

    container.innerHTML = `
      <div class="kpi-grid">
        ${kpiCard(k.uniqueImei, "Унікальних IMEI (пристроїв у вибірці)", "", "Кількість унікальних пристроїв (за номером IMEI) у поточній вибірці з урахуванням застосованих фільтрів.")}
        ${kpiCard(k.problemImei, "Проблемних IMEI (2+ ремонти/звернення)", levelClass(k.uniqueImei ? k.problemImei / k.uniqueImei * 100 : 0, 15, 30), "IMEI вважається проблемним, якщо має 2+ ремонти, 2+ звернення, повторну причину звернення або 2+ обміни.")}
        ${kpiCard(k.totalRepairs, "Ремонтів усього (подій \"Виробництво\")", "", "Загальна кількість подій \"Ремонт\" (Виробництво) по всіх IMEI вибірки.")}
        ${kpiCard(k.totalClaims, "Звернень усього (повторні оприбуткування)", "", "Загальна кількість повторних оприбуткувань (повернень клієнтами) після продажу.")}
        ${kpiCard(fmtNum(k.avgRepairsPerImei, 2), "Сер. ремонтів на 1 IMEI (навантаження)", levelClass(k.avgRepairsPerImei, 1, 2), "Загальна к-сть ремонтів, поділена на к-сть унікальних IMEI. Показує середнє навантаження на один пристрій.")}
        ${kpiCard(fmtNum(k.avgDaysSaleToReturn, 0) + " дн.", "Сер. період продаж → повернення (днів)", "", "Середня кількість днів між останнім продажем пристрою та першим зверненням (поверненням) клієнта.")}
        ${kpiCard(fmtNum(k.avgDaysBetweenRepairs, 0) + " дн.", "Сер. період між ремонтами (днів)", "", "Середній інтервал у днях між послідовними ремонтами одного й того ж IMEI.")}
        ${kpiCard(k.imei2plus, "IMEI з 2+ ремонтами (повторні ремонти)", levelClass(k.uniqueImei ? k.imei2plus / k.uniqueImei * 100 : 0, 10, 25), "К-сть унікальних IMEI, які ремонтувались двічі або більше.")}
        ${kpiCard(k.imei3plus, "IMEI з 3+ ремонтами (критична група)", levelClass(k.uniqueImei ? k.imei3plus / k.uniqueImei * 100 : 0, 5, 15), "К-сть унікальних IMEI, які ремонтувались тричі або більше — критична група для перевірки якості.")}
        ${kpiCard(k.worstModel ? k.worstModel.model : "—", "Модель з найбільшим % проблемних IMEI", k.worstModel ? "bad" : "", "Модель з найвищим відсотком проблемних IMEI серед своїх пристроїв (див. вкладку \"Моделі\"). Враховуються лише моделі з 5+ IMEI, щоб уникнути викривлення через малу вибірку.")}
        ${kpiCard(k.worstOwner ? k.worstOwner.owner : "—", "Власник партії з найбільшою кількістю ремонтів", k.worstOwner ? "bad" : "", "Власник партії, чиї товари сумарно потребували найбільшої кількості ремонтів (див. вкладку \"Власники партій\").")}
        ${kpiCard(k.worstMaster ? `${k.worstMaster.master} (${fmtNum(k.worstMaster.repeatRate, 0)}%)` : "—", "Майстер з найбільшим % повторних звернень (2+ ремонти)", k.worstMaster ? "bad" : "", "Майстер ремонту (з 2+ ремонтами), після роботи якого пристрої найчастіше повертаються знову (див. вкладку \"Майстри\").")}
      </div>

      <div class="charts-grid">
        <div class="chart-card">
          <h3>ТОП-10 проблемних моделей (за к-стю ремонтів)</h3>
          <p class="hint">Моделі з найбільшою сумарною кількістю ремонтів серед усіх своїх IMEI.</p>
          <div class="chart-wrap"><canvas id="dash-chart-models"></canvas></div>
        </div>
        <div class="chart-card">
          <h3>ТОП-10 проблемних IMEI (ремонти + звернення)</h3>
          <p class="hint">Конкретні пристрої з найбільшою сумою (к-сть ремонтів + к-сть звернень). Останні 8 цифр IMEI на осі.</p>
          <div class="chart-wrap"><canvas id="dash-chart-imei"></canvas></div>
        </div>
        <div class="chart-card">
          <h3>ТОП-10 власників партій за % проблемних IMEI</h3>
          <p class="hint">Власники партій, у яких найбільша частка пристроїв виявилась проблемною.</p>
          <div class="chart-wrap"><canvas id="dash-chart-owners"></canvas></div>
        </div>
        <div class="chart-card">
          <h3>ТОП-10 майстрів за % повторних звернень (мін. 2 ремонти)</h3>
          <p class="hint">Майстри (з 2+ ремонтами), після ремонту яких пристрої найчастіше повертаються знову — % повторних звернень.</p>
          <div class="chart-wrap"><canvas id="dash-chart-masters"></canvas></div>
        </div>
        <div class="chart-card">
          <h3>Ремонти по днях</h3>
          <p class="hint">Кількість подій "Ремонт" (Виробництво) по датах їх виконання — показує динаміку навантаження на ремонтну службу.</p>
          <div class="chart-wrap"><canvas id="dash-chart-daily-repairs"></canvas></div>
        </div>
      </div>
    `;

    const models = aggregateByModel(imeiAgg).filter((m) => m.repairs > 0).slice(0, 10);
    barChart(
      document.getElementById("dash-chart-models"),
      models.map((m) => m.model),
      models.map((m) => m.repairs),
      { horizontal: true, color: "#ef4444", title: "Ремонтів" }
    );

    const topImei = [...imeiAgg].filter((r) => r.repairCount + r.claimCount > 0).slice(0, 10);
    barChart(
      document.getElementById("dash-chart-imei"),
      topImei.map((r) => r.imei.slice(-8)),
      topImei.map((r) => r.repairCount + r.claimCount),
      { horizontal: true, color: "#f59e0b", title: "Ремонти + звернення" }
    );

    const owners = aggregateByOwner(imeiAgg).filter((o) => o.total >= 1).slice(0, 10);
    barChart(
      document.getElementById("dash-chart-owners"),
      owners.map((o) => o.owner),
      owners.map((o) => o.problemRate),
      { horizontal: true, color: "#8b5cf6", title: "% проблемних" }
    );

    const masters = aggregateByMaster(records).filter((m) => m.repairs >= 2).sort((a, b) => b.repeatRate - a.repeatRate).slice(0, 10);
    barChart(
      document.getElementById("dash-chart-masters"),
      masters.map((m) => m.master),
      masters.map((m) => m.repeatRate),
      { horizontal: true, color: "#06b6d4", title: "% повторних" }
    );

    const dailyRepairs = dailyRepairsSeries(imeiAgg);
    lineChart(
      document.getElementById("dash-chart-daily-repairs"),
      dailyRepairs.map((d) => fmtDate(d.date)),
      [{ label: "Ремонтів", data: dailyRepairs.map((d) => d.count) }]
    );
  }
};

function kpiCard(value, label, level = "", desc = "") {
  const title = desc ? ` title="${escapeHtml(desc)}"` : "";
  return `<div class="kpi ${level}"${title}><div class="kpi-value">${value}</div><div class="kpi-label">${escapeHtml(label)}</div></div>`;
}
