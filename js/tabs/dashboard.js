// Вкладка "Дашборд": KPI-картки + ключові графіки.

const TabDashboard = {
  render(container, { records, imeiAgg }) {
    const k = computeKpis(records, imeiAgg);

    container.innerHTML = `
      <div class="kpi-grid">
        ${kpiCard(k.uniqueImei, "Унікальних IMEI")}
        ${kpiCard(k.problemImei, "Проблемних IMEI", levelClass(k.uniqueImei ? k.problemImei / k.uniqueImei * 100 : 0, 15, 30))}
        ${kpiCard(k.totalRepairs, "Ремонтів усього")}
        ${kpiCard(k.totalClaims, "Звернень усього")}
        ${kpiCard(fmtNum(k.avgRepairsPerImei, 2), "Сер. ремонтів на 1 IMEI", levelClass(k.avgRepairsPerImei, 1, 2))}
        ${kpiCard(fmtNum(k.avgDaysSaleToReturn, 0) + " дн.", "Сер. період продаж → повернення")}
        ${kpiCard(fmtNum(k.avgDaysBetweenRepairs, 0) + " дн.", "Сер. період між ремонтами")}
        ${kpiCard(k.imei2plus, "IMEI з 2+ ремонтами", levelClass(k.uniqueImei ? k.imei2plus / k.uniqueImei * 100 : 0, 10, 25))}
        ${kpiCard(k.imei3plus, "IMEI з 3+ ремонтами", levelClass(k.uniqueImei ? k.imei3plus / k.uniqueImei * 100 : 0, 5, 15))}
        ${kpiCard(k.worstModel ? k.worstModel.model : "—", "Найпроблемніша модель", k.worstModel ? "bad" : "")}
        ${kpiCard(k.worstOwner ? k.worstOwner.owner : "—", "Найпроблемніший власник партії", k.worstOwner ? "bad" : "")}
        ${kpiCard(k.worstMaster ? `${k.worstMaster.master} (${fmtNum(k.worstMaster.repeatRate, 0)}%)` : "—", "Майстер з найбільшим % повторних звернень", k.worstMaster ? "bad" : "")}
      </div>

      <div class="charts-grid">
        <div class="chart-card">
          <h3>ТОП-10 проблемних моделей (за к-стю ремонтів)</h3>
          <div class="chart-wrap"><canvas id="dash-chart-models"></canvas></div>
        </div>
        <div class="chart-card">
          <h3>ТОП-10 проблемних IMEI (ремонти + звернення)</h3>
          <div class="chart-wrap"><canvas id="dash-chart-imei"></canvas></div>
        </div>
        <div class="chart-card">
          <h3>ТОП-10 власників партій за % проблемних IMEI</h3>
          <div class="chart-wrap"><canvas id="dash-chart-owners"></canvas></div>
        </div>
        <div class="chart-card">
          <h3>ТОП-10 майстрів за % повторних звернень (мін. 2 ремонти)</h3>
          <div class="chart-wrap"><canvas id="dash-chart-masters"></canvas></div>
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
  }
};

function kpiCard(value, label, level = "") {
  return `<div class="kpi ${level}"><div class="kpi-value">${value}</div><div class="kpi-label">${escapeHtml(label)}</div></div>`;
}
