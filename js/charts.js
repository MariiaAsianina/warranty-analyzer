// Обгортки над Chart.js для аналітичних графіків.

const CHART_COLORS = ["#3b82f6", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

function destroyChart(canvas) {
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();
}

function barChart(canvas, labels, data, { horizontal = false, color = CHART_COLORS[0], title = "" } = {}) {
  destroyChart(canvas);
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: title, data, backgroundColor: color, borderRadius: 4 }]
    },
    options: {
      indexAxis: horizontal ? "y" : "x",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, title: { display: !!title, text: title } },
      scales: { x: { beginAtZero: true }, y: { beginAtZero: true } }
    }
  });
}

function lineChart(canvas, labels, datasets, { title = "" } = {}) {
  destroyChart(canvas);
  return new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: datasets.map((d, i) => ({
        ...d,
        borderColor: CHART_COLORS[i % CHART_COLORS.length],
        backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + "33",
        tension: 0.25,
        fill: false
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: datasets.length > 1 }, title: { display: !!title, text: title } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function paretoChart(canvas, labels, counts, cumPercents) {
  destroyChart(canvas);
  return new Chart(canvas, {
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "Кількість",
          data: counts,
          backgroundColor: CHART_COLORS[0],
          yAxisID: "y"
        },
        {
          type: "line",
          label: "Накопичувальний %",
          data: cumPercents,
          borderColor: CHART_COLORS[2],
          backgroundColor: "transparent",
          yAxisID: "y1",
          tension: 0.2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, position: "left" },
        y1: { beginAtZero: true, max: 100, position: "right", grid: { drawOnChartArea: false } }
      }
    }
  });
}

/** Рендерить heatmap у вигляді HTML-таблиці з градієнтом кольорів. */
function renderHeatmap(container, { rows, cols, matrix }, rowLabel = "") {
  const max = Math.max(1, ...matrix.flat());
  let html = `<table class="heatmap"><thead><tr><th>${escapeHtml(rowLabel)}</th>`;
  for (const c of cols) html += `<th>${escapeHtml(c)}</th>`;
  html += "</tr></thead><tbody>";
  rows.forEach((r, i) => {
    html += `<tr><th>${escapeHtml(r)}</th>`;
    cols.forEach((c, j) => {
      const v = matrix[i][j];
      const intensity = v / max;
      const bg = v === 0 ? "transparent" : `rgba(239, 68, 68, ${0.12 + intensity * 0.7})`;
      html += `<td style="background:${bg}">${v || ""}</td>`;
    });
    html += "</tr>";
  });
  html += "</tbody></table>";
  container.innerHTML = html;
}
