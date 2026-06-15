// Вкладка "Дашборд": KPI-картки, інсайти та ключові графіки.

const TabDashboard = {
  repairsScale: "month",
  claimsScale: "month",

  render(container, { records, imeiAgg }) {
    const k = computeKpis(records, imeiAgg);

    const models = aggregateByModel(imeiAgg).filter((m) => m.repairs > 0).slice(0, 10);
    const topImei = [...imeiAgg].filter((r) => r.repairCount + r.claimCount > 0).slice(0, 10);
    const owners = aggregateByOwner(imeiAgg).filter((o) => o.total >= MIN_SAMPLE).slice(0, 10);
    const masters = aggregateByMaster(imeiAgg).filter((m) => m.repairs >= MASTER_MIN_REPAIRS).sort((a, b) => b.repeatRate - a.repeatRate).slice(0, 10);
    const claimHistogram = daysToFirstClaimHistogram(imeiAgg);
    const avgRepairModels = aggregateByModel(imeiAgg).filter((m) => m.total >= MIN_SAMPLE).sort((a, b) => b.avgRepairsPerImei - a.avgRepairsPerImei).slice(0, 10);

    const insights = buildInsights(k, imeiAgg);

    container.innerHTML = `
      <div class="kpi-grid">
        ${kpiCard(k.uniqueImei, "Унікальних IMEI (пристроїв у вибірці)", "", "Кількість унікальних пристроїв (за номером IMEI) у поточній вибірці з урахуванням застосованих фільтрів.")}
        ${kpiCard(k.problemImei, "Проблемних IMEI (2+ ремонти/звернення)", levelClass(k.uniqueImei ? k.problemImei / k.uniqueImei * 100 : 0, 15, 30), "IMEI вважається проблемним, якщо має 2+ ремонти, 2+ звернення (повернення після продажу) або повторну причину звернення.")}
        ${kpiCard(k.totalRepairs, "Ремонтів усього (подій \"Виробництво\")", "", "Загальна кількість подій \"Ремонт\" (Виробництво) по всіх IMEI вибірки.")}
        ${kpiCard(k.totalClaims, "Звернень усього (повторні оприбуткування)", "", "Загальна кількість повторних оприбуткувань (повернень клієнтами) після продажу.")}
        ${kpiCard(fmtNum(k.avgRepairsPerImei, 2), "Сер. ремонтів на 1 IMEI (навантаження)", levelClass(k.avgRepairsPerImei, 1, 2), "Загальна к-сть ремонтів, поділена на к-сть унікальних IMEI. Показує середнє навантаження на один пристрій.")}
        ${kpiCard(fmtNum(k.avgDaysSaleToReturn, 0) + " дн.", "Сер. період продаж → звернення (днів)", "", "Середня кількість днів між останнім продажем пристрою та першим зверненням (поверненням) клієнта.")}
        ${kpiCard(fmtNum(k.avgDaysBetweenRepairs, 0) + " дн.", "Сер. період між ремонтами (днів)", "", "Середній інтервал у днях між послідовними ремонтами одного й того ж IMEI.")}
        ${kpiCard(k.imei2plus, "IMEI з 2+ ремонтами (повторні ремонти)", levelClass(k.uniqueImei ? k.imei2plus / k.uniqueImei * 100 : 0, 10, 25), "К-сть унікальних IMEI, які ремонтувались двічі або більше.")}
        ${kpiCard(k.imei3plus, "IMEI з 3+ ремонтами (критична група)", levelClass(k.uniqueImei ? k.imei3plus / k.uniqueImei * 100 : 0, 5, 15), "К-сть унікальних IMEI, які ремонтувались тричі або більше — критична група для перевірки якості.")}
        ${kpiCard(k.worstModel ? k.worstModel.model : "—", "Модель з найбільшим % проблемних IMEI", k.worstModel ? "bad" : "", `Модель з найвищим відсотком проблемних IMEI серед своїх пристроїв (див. вкладку "Моделі"). Враховуються лише моделі з ${MIN_SAMPLE}+ IMEI, щоб уникнути викривлення через малу вибірку.`)}
        ${kpiCard(k.worstOwner ? k.worstOwner.owner : "—", "Власник партії з найбільшою кількістю ремонтів", k.worstOwner ? "bad" : "", "Власник партії, чиї товари сумарно потребували найбільшої кількості ремонтів (див. вкладку \"Власники партій\").")}
        ${kpiCard(k.worstMaster ? `${k.worstMaster.master} (${fmtNum(k.worstMaster.repeatRate, 0)}%)` : "—", "Майстер з найбільшим % повторних звернень", k.worstMaster ? "bad" : "", `Майстер ремонту (з ${MASTER_MIN_REPAIRS}+ ремонтами), після роботи якого пристрої найчастіше потребують повторного звернення чи ремонту (див. вкладку "Майстри").`)}
      </div>

      <h3>Інсайти</h3>
      <ul class="insights-list">
        ${insights.map((i) => `<li>${i}</li>`).join("")}
      </ul>

      <div class="charts-grid cols-2">
        <div class="chart-card">
          <h3>ТОП-10 проблемних моделей (за к-стю ремонтів)</h3>
          <p class="hint">Моделі з найбільшою сумарною кількістю ремонтів серед усіх своїх IMEI.</p>
          <div class="chart-wrap"><canvas id="dash-chart-models"></canvas></div>
          <div class="chart-table-wrap">
            <table class="data-table">
              <thead><tr><th>Модель</th><th>К-сть IMEI</th><th>Ремонтів</th><th>Звернень</th><th>% проблемних</th></tr></thead>
              <tbody id="dash-table-models"></tbody>
            </table>
          </div>
        </div>

        <div class="chart-card">
          <h3>ТОП-10 проблемних IMEI (ремонти + звернення)</h3>
          <p class="hint">Конкретні пристрої з найбільшою сумою (к-сть ремонтів + к-сть звернень). Останні 8 цифр IMEI на осі, повний IMEI — у таблиці нижче.</p>
          <div class="chart-wrap"><canvas id="dash-chart-imei"></canvas></div>
          <div class="chart-table-wrap">
            <table class="data-table">
              <thead><tr><th>IMEI</th><th>Модель</th><th>Ремонтів</th><th>Звернень</th><th>Власник партії</th></tr></thead>
              <tbody id="dash-table-imei"></tbody>
            </table>
          </div>
        </div>

        <div class="chart-card">
          <h3>ТОП-10 власників партій за % проблемних IMEI (мін. ${MIN_SAMPLE} IMEI)</h3>
          <p class="hint">Власники партій з ${MIN_SAMPLE}+ IMEI, у яких найбільша частка пристроїв виявилась проблемною.</p>
          <div class="chart-wrap"><canvas id="dash-chart-owners"></canvas></div>
          <div class="chart-table-wrap">
            <table class="data-table">
              <thead><tr><th>Власник партії</th><th>К-сть IMEI</th><th>Ремонтів</th><th>% проблемних</th></tr></thead>
              <tbody id="dash-table-owners"></tbody>
            </table>
          </div>
        </div>

        <div class="chart-card">
          <h3>ТОП-10 майстрів за % повторних звернень (мін. ${MASTER_MIN_REPAIRS} ремонтів)</h3>
          <p class="hint">Майстри з ${MASTER_MIN_REPAIRS}+ ремонтами, після ремонту яких пристрої найчастіше потребують повторного звернення чи ремонту.</p>
          <div class="chart-wrap"><canvas id="dash-chart-masters"></canvas></div>
          <div class="chart-table-wrap">
            <table class="data-table">
              <thead><tr><th>Майстер</th><th>Ремонтів</th><th>Повторних</th><th>% повторних</th></tr></thead>
              <tbody id="dash-table-masters"></tbody>
            </table>
          </div>
        </div>

        <div class="chart-card">
          <h3>Ремонти по датах</h3>
          <p class="hint">Кількість подій "Ремонт" (Виробництво) по датах їх виконання — динаміка навантаження на ремонтну службу.</p>
          <div class="chart-toolbar">
            <select id="dash-repairs-scale" class="input" title="Масштаб групування дат на графіку.">
              <option value="day">День</option>
              <option value="week">Тиждень</option>
              <option value="month">Місяць</option>
            </select>
          </div>
          <div class="chart-wrap"><canvas id="dash-chart-repairs-time"></canvas></div>
          <div class="chart-table-wrap">
            <table class="data-table">
              <thead><tr><th>Період</th><th>Ремонтів</th></tr></thead>
              <tbody id="dash-table-repairs-time"></tbody>
            </table>
          </div>
        </div>

        <div class="chart-card">
          <h3>Звернення по датах</h3>
          <p class="hint">Кількість звернень (оприбуткувань після продажу) по датах — динаміка повернень клієнтів.</p>
          <div class="chart-toolbar">
            <select id="dash-claims-scale" class="input" title="Масштаб групування дат на графіку.">
              <option value="day">День</option>
              <option value="week">Тиждень</option>
              <option value="month">Місяць</option>
            </select>
          </div>
          <div class="chart-wrap"><canvas id="dash-chart-claims-time"></canvas></div>
          <div class="chart-table-wrap">
            <table class="data-table">
              <thead><tr><th>Період</th><th>Звернень</th></tr></thead>
              <tbody id="dash-table-claims-time"></tbody>
            </table>
          </div>
        </div>

        <div class="chart-card">
          <h3>Дні від продажу до першого звернення</h3>
          <p class="hint">Розподіл IMEI за кількістю днів між продажем і першим зверненням клієнта. Показує, як швидко проявляються дефекти.</p>
          <div class="chart-wrap"><canvas id="dash-chart-claim-delay"></canvas></div>
          <div class="chart-table-wrap">
            <table class="data-table">
              <thead><tr><th>Період</th><th>К-сть IMEI</th><th>% від звернень</th></tr></thead>
              <tbody id="dash-table-claim-delay"></tbody>
            </table>
          </div>
        </div>

        <div class="chart-card">
          <h3>ТОП-10 моделей за середньою к-стю ремонтів на IMEI (мін. ${MIN_SAMPLE} IMEI)</h3>
          <p class="hint">Моделі, у яких в середньому на один IMEI припадає найбільше ремонтів — "хронічні" моделі, навіть якщо їх мало в обігу.</p>
          <div class="chart-wrap"><canvas id="dash-chart-avg-repairs"></canvas></div>
          <div class="chart-table-wrap">
            <table class="data-table">
              <thead><tr><th>Модель</th><th>К-сть IMEI</th><th>Ремонтів</th><th>Сер. ремонтів/IMEI</th></tr></thead>
              <tbody id="dash-table-avg-repairs"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    barChart(
      document.getElementById("dash-chart-models"),
      models.map((m) => m.model),
      models.map((m) => m.repairs),
      { horizontal: true, color: "#ef4444", title: "Ремонтів" }
    );
    setTable("dash-table-models", models.map((m) => [escapeHtml(m.model), m.total, m.repairs, m.claims, fmtPercent(m.problemRate)]));

    barChart(
      document.getElementById("dash-chart-imei"),
      topImei.map((r) => r.imei.slice(-8)),
      topImei.map((r) => r.repairCount + r.claimCount),
      { horizontal: true, color: "#f59e0b", title: "Ремонти + звернення" }
    );
    setTable("dash-table-imei", topImei.map((r) => [escapeHtml(r.imei), escapeHtml(r.modelLabel), r.repairCount, r.claimCount, escapeHtml(r.owner || "—")]));

    barChart(
      document.getElementById("dash-chart-owners"),
      owners.map((o) => o.owner),
      owners.map((o) => o.problemRate),
      { horizontal: true, color: "#8b5cf6", title: "% проблемних" }
    );
    setTable("dash-table-owners", owners.map((o) => [escapeHtml(o.owner), o.total, o.repairs, fmtPercent(o.problemRate)]));

    barChart(
      document.getElementById("dash-chart-masters"),
      masters.map((m) => m.master),
      masters.map((m) => m.repeatRate),
      { horizontal: true, color: "#06b6d4", title: "% повторних" }
    );
    setTable("dash-table-masters", masters.map((m) => [escapeHtml(m.master), m.repairs, m.repeatsAfter, fmtPercent(m.repeatRate)]));

    const totalClaimDelay = claimHistogram.reduce((s, b) => s + b.count, 0);
    barChart(
      document.getElementById("dash-chart-claim-delay"),
      claimHistogram.map((b) => b.label),
      claimHistogram.map((b) => b.count),
      { color: "#10b981", title: "К-сть IMEI" }
    );
    setTable("dash-table-claim-delay", claimHistogram.map((b) => [escapeHtml(b.label), b.count, totalClaimDelay ? fmtPercent(b.count / totalClaimDelay * 100) : "—"]));

    barChart(
      document.getElementById("dash-chart-avg-repairs"),
      avgRepairModels.map((m) => m.model),
      avgRepairModels.map((m) => m.avgRepairsPerImei),
      { horizontal: true, color: "#ec4899", title: "Сер. ремонтів / IMEI" }
    );
    setTable("dash-table-avg-repairs", avgRepairModels.map((m) => [escapeHtml(m.model), m.total, m.repairs, fmtNum(m.avgRepairsPerImei, 2)]));

    this.renderRepairsChart(imeiAgg);
    this.renderClaimsChart(imeiAgg);

    const repairsScaleSelect = document.getElementById("dash-repairs-scale");
    repairsScaleSelect.value = this.repairsScale;
    repairsScaleSelect.addEventListener("change", () => {
      this.repairsScale = repairsScaleSelect.value;
      this.renderRepairsChart(imeiAgg);
    });

    const claimsScaleSelect = document.getElementById("dash-claims-scale");
    claimsScaleSelect.value = this.claimsScale;
    claimsScaleSelect.addEventListener("change", () => {
      this.claimsScale = claimsScaleSelect.value;
      this.renderClaimsChart(imeiAgg);
    });
  },

  renderRepairsChart(imeiAgg) {
    const series = repairDateSeries(imeiAgg, this.repairsScale);
    lineChart(
      document.getElementById("dash-chart-repairs-time"),
      series.map((s) => dateBucketLabel(s.key, this.repairsScale)),
      [{ label: "Ремонтів", data: series.map((s) => s.count) }]
    );
    setTable("dash-table-repairs-time", series.map((s) => [dateBucketLabel(s.key, this.repairsScale), s.count]));
  },

  renderClaimsChart(imeiAgg) {
    const series = claimDateSeries(imeiAgg, this.claimsScale);
    lineChart(
      document.getElementById("dash-chart-claims-time"),
      series.map((s) => dateBucketLabel(s.key, this.claimsScale)),
      [{ label: "Звернень", data: series.map((s) => s.count) }]
    );
    setTable("dash-table-claims-time", series.map((s) => [dateBucketLabel(s.key, this.claimsScale), s.count]));
  }
};

function kpiCard(value, label, level = "", desc = "") {
  const title = desc ? ` title="${escapeHtml(desc)}"` : "";
  return `<div class="kpi ${level}"${title}><div class="kpi-value">${value}</div><div class="kpi-label">${escapeHtml(label)}</div></div>`;
}

/** Заповнює <tbody id="..."> рядками таблиці під графіком. Кожен рядок — масив готових (escaped) значень. */
function setTable(id, rows) {
  const tbody = document.getElementById(id);
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td>Немає даних</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("");
}

/** Формує список авто-інсайтів для головного дашборду. */
function buildInsights(k, imeiAgg) {
  const items = [];

  if (k.worstModel) {
    items.push(`Найпроблемніша модель: <strong>${escapeHtml(k.worstModel.model)}</strong> — ${fmtPercent(k.worstModel.problemRate)} проблемних IMEI (${k.worstModel.problemCount} з ${k.worstModel.total}).`);
  }

  const worstImei = imeiAgg[0];
  if (worstImei && worstImei.repairCount + worstImei.claimCount > 0) {
    items.push(`Найбільше ремонтів і звернень в одного пристрою: IMEI <strong>${escapeHtml(worstImei.imei)}</strong> (${escapeHtml(worstImei.modelLabel)}) — ${worstImei.repairCount} ремонт(ів), ${worstImei.claimCount} звернення(ь).`);
  }

  if (k.worstOwner) {
    items.push(`Власник партії з найбільшою кількістю ремонтів: <strong>${escapeHtml(k.worstOwner.owner)}</strong> — ${k.worstOwner.repairs} ремонт(ів) серед ${k.worstOwner.total} IMEI.`);
  }

  if (k.worstMaster) {
    items.push(`Майстер з найбільшим % повторних звернень: <strong>${escapeHtml(k.worstMaster.master)}</strong> — ${fmtPercent(k.worstMaster.repeatRate)} (${k.worstMaster.repeatsAfter} з ${k.worstMaster.repairs} ремонтів).`);
  }

  if (k.avgDaysSaleToReturn !== null) {
    items.push(`Середній термін від продажу до звернення: <strong>${fmtNum(k.avgDaysSaleToReturn, 0)} дн.</strong>`);
  }

  return items.length ? items : ["Недостатньо даних для інсайтів."];
}
