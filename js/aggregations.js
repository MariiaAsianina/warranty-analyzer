// Допоміжні функції агрегації даних для аналізу гарантійних обмінів.

function daysBetween(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return null;
  const a = new Date(dateFrom);
  const b = new Date(dateTo);
  return Math.round((b - a) / 86400000);
}

function countBy(records, keyFn) {
  const map = new Map();
  for (const r of records) {
    const key = keyFn(r);
    if (key === null || key === undefined || key === "") continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].map(([key, count]) => ({ key, count }));
}

function topN(records, keyFn, n = 10) {
  return countBy(records, keyFn).sort((a, b) => b.count - a.count).slice(0, n);
}

function uniqueValues(records, keyFn) {
  return [...new Set(records.map(keyFn).filter((v) => v !== null && v !== undefined && v !== ""))].sort((a, b) =>
    String(a).localeCompare(String(b), "uk")
  );
}

function average(arr) {
  const vals = arr.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Накопичувальний Pareto-ряд для топ значень. */
function paretoSeries(records, keyFn, n = 15) {
  const counts = countBy(records, keyFn).sort((a, b) => b.count - a.count);
  const total = counts.reduce((s, c) => s + c.count, 0);
  let cum = 0;
  return counts.slice(0, n).map((c) => {
    cum += c.count;
    return { ...c, percent: total ? (c.count / total) * 100 : 0, cumPercent: total ? (cum / total) * 100 : 0 };
  });
}

/** Місячний ряд (YYYY-MM -> кількість) за заданим полем дати. */
function monthlySeries(records, dateFn) {
  const map = new Map();
  for (const r of records) {
    const d = dateFn(r);
    if (!d) continue;
    const key = d.slice(0, 7);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count }));
}

/** Перехресна таблиця (heatmap) row × col -> кількість. */
function crossTab(records, rowKeyFn, colKeyFn, maxRows = 10, maxCols = 8) {
  const rowCounts = new Map();
  const colCounts = new Map();
  const cellCounts = new Map();

  for (const r of records) {
    const rk = rowKeyFn(r);
    const ck = colKeyFn(r);
    if (!rk || !ck) continue;
    rowCounts.set(rk, (rowCounts.get(rk) || 0) + 1);
    colCounts.set(ck, (colCounts.get(ck) || 0) + 1);
    const cellKey = rk + "" + ck;
    cellCounts.set(cellKey, (cellCounts.get(cellKey) || 0) + 1);
  }

  const rows = [...rowCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxRows).map(([k]) => k);
  const cols = [...colCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxCols).map(([k]) => k);

  const matrix = rows.map((rk) => cols.map((ck) => cellCounts.get(rk + "" + ck) || 0));
  return { rows, cols, matrix };
}

/** Групує записи по IMEI і обчислює сукупні показники по всій історії звернень. */
function aggregateByImei(records) {
  const map = new Map();
  for (const r of records) {
    if (!r.imei) continue;
    if (!map.has(r.imei)) map.set(r.imei, { imei: r.imei, exchanges: [], events: [], reasons: [], owners: [] });
    const g = map.get(r.imei);
    g.exchanges.push(r);
    g.events.push(...r.events);
    if (r.reason) g.reasons.push(r.reason);
    if (r.owner) g.owners.push(r.owner);
  }

  const result = [];
  for (const g of map.values()) {
    const events = [...g.events].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const sales = events.filter((e) => e.type === "sale");
    const receipts = events.filter((e) => e.type === "receipt");
    const repairs = events.filter((e) => e.type === "production");
    const saleDate = sales.length ? sales[0].date : null;
    const lastSaleDate = sales.length ? sales[sales.length - 1].date : null;
    const claims = saleDate ? receipts.filter((e) => e.date && e.date > saleDate) : receipts.slice(1);
    const uniqueReasons = new Set(g.reasons);
    const sameReasonRepeat = g.reasons.length > uniqueReasons.size;

    const repairDates = repairs.map((e) => e.date).filter(Boolean);
    const gaps = [];
    for (let i = 1; i < repairDates.length; i++) {
      const d = daysBetween(repairDates[i - 1], repairDates[i]);
      if (d !== null) gaps.push(d);
    }

    // "Останній продаж -> повернення": для першого звернення (claim) шукаємо
    // останню дату продажу, що сталась до нього.
    const firstClaim = claims[0];
    let lastSaleBeforeClaim = null;
    if (firstClaim) {
      for (const s of sales) {
        if (s.date && firstClaim.date && s.date <= firstClaim.date) lastSaleBeforeClaim = s.date;
      }
    }
    const daysSaleToReturn = firstClaim ? daysBetween(lastSaleBeforeClaim, firstClaim.date) : null;

    const first = g.exchanges[0];
    const modelLabel = `${first.brand || ""} ${first.model || ""}`.trim() || "Невідома модель";
    result.push({
      imei: g.imei,
      productRaw: first.productRaw,
      brand: first.brand,
      model: first.model,
      modelLabel,
      memory: first.memory,
      color: first.color,
      owners: [...new Set(g.owners)],
      owner: first.owner,
      store: first.store,
      city: first.city,
      batchDoc: first.batchDoc,
      exchangeCount: g.exchanges.length,
      claimCount: claims.length,
      repairCount: repairs.length,
      receiptCount: receipts.length,
      repeatClaims: Math.max(0, claims.length - 1),
      repeatRepairs: Math.max(0, repairs.length - 1),
      saleDate,
      lastSaleDate,
      firstClaimDate: firstClaim?.date || null,
      lastSaleBeforeClaim,
      daysSaleToReturn,
      daysToFirstClaim: saleDate && firstClaim ? daysBetween(saleDate, firstClaim.date) : null,
      avgDaysBetweenRepairs: gaps.length ? average(gaps) : null,
      repairMasters: [...new Set(repairs.map((e) => e.repairMaster).filter(Boolean))],
      events: events.filter((e) => e.date),
      reasons: [...uniqueReasons],
      sameReasonRepeat,
      problem: repairs.length >= 2 || claims.length >= 2 || sameReasonRepeat || g.exchanges.length >= 2
    });
  }
  return result.sort((a, b) => (b.repairCount + b.claimCount) - (a.repairCount + a.claimCount));
}

/** Групує агреговані IMEI за власником партії. */
function aggregateByOwner(imeiAgg) {
  const map = new Map();
  for (const r of imeiAgg) {
    const key = r.owner || "Невідомо";
    if (!map.has(key)) map.set(key, { owner: key, items: [] });
    map.get(key).items.push(r);
  }
  return [...map.values()].map(({ owner, items }) => {
    const total = items.length;
    const repairs = items.reduce((s, r) => s + (r.repairCount || 0), 0);
    const claims = items.reduce((s, r) => s + (r.claimCount || 0), 0);
    const problematic = items.filter((r) => r.problem).length;
    const returnDays = items.map((r) => r.daysSaleToReturn).filter((v) => v !== null);
    const topModels = topN(items, (r) => r.modelLabel, 3);
    return {
      owner,
      total,
      repairs,
      claims,
      avgRepairsPerImei: total ? repairs / total : 0,
      avgDaysSaleToReturn: returnDays.length ? average(returnDays) : null,
      problemCount: problematic,
      problemRate: total ? (problematic / total) * 100 : 0,
      topModels
    };
  }).sort((a, b) => b.problemRate - a.problemRate || b.total - a.total);
}

/** Групує агреговані IMEI за моделлю (бренд + модель). */
function aggregateByModel(imeiAgg) {
  const map = new Map();
  for (const r of imeiAgg) {
    const key = r.modelLabel;
    if (!map.has(key)) map.set(key, { model: key, items: [] });
    map.get(key).items.push(r);
  }
  return [...map.values()].map(({ model, items }) => {
    const total = items.length;
    const repairs = items.reduce((s, r) => s + (r.repairCount || 0), 0);
    const claims = items.reduce((s, r) => s + (r.claimCount || 0), 0);
    const problematic = items.filter((r) => r.problem).length;
    const returnDays = items.map((r) => r.daysSaleToReturn).filter((v) => v !== null);
    return {
      model,
      total,
      repairs,
      claims,
      avgRepairsPerImei: total ? repairs / total : 0,
      avgDaysSaleToReturn: returnDays.length ? average(returnDays) : null,
      problemCount: problematic,
      problemRate: total ? (problematic / total) * 100 : 0
    };
  }).sort((a, b) => b.problemRate - a.problemRate || b.repairs - a.repairs);
}

/** Статистика по причинах звернень (на основі сирих записів). */
function aggregateByReason(records) {
  const map = new Map();
  for (const r of records) {
    const key = r.reason || "Невідомо";
    if (!map.has(key)) map.set(key, { reason: key, items: [] });
    map.get(key).items.push(r);
  }
  const total = records.length;
  return [...map.values()].map(({ reason, items }) => ({
    reason,
    count: items.length,
    percent: total ? (items.length / total) * 100 : 0,
    repairs: items.reduce((s, r) => s + (r.repairCount || 0), 0)
  })).sort((a, b) => b.count - a.count);
}

/** Статистика по майстрах ремонту, обчислена з подій типу "production". */
function aggregateByMaster(records) {
  const map = new Map();
  for (const r of records) {
    const sorted = r.events;
    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i];
      if (e.type !== "production" || !e.repairMaster) continue;
      const key = e.repairMaster;
      if (!map.has(key)) {
        map.set(key, { master: key, repairs: 0, byBrand: new Map(), byModel: new Map(), repeatsAfter: 0, gaps: [], returnedImeis: new Set() });
      }
      const m = map.get(key);
      m.repairs++;
      m.byBrand.set(r.brand, (m.byBrand.get(r.brand) || 0) + 1);
      const modelLabel = `${r.brand || ""} ${r.model || ""}`.trim() || "Невідома модель";
      m.byModel.set(modelLabel, (m.byModel.get(modelLabel) || 0) + 1);

      const later = sorted.slice(i + 1).some(
        (ev) => ev.date && e.date && ev.date > e.date && (ev.type === "receipt" || ev.type === "production")
      );
      if (later) {
        m.repeatsAfter++;
        m.returnedImeis.add(r.imei);
      }

      const priorReceipt = [...sorted.slice(0, i)].reverse().find((ev) => ev.type === "receipt");
      if (priorReceipt && priorReceipt.date && e.date) {
        const d = daysBetween(priorReceipt.date, e.date);
        if (d !== null) m.gaps.push(d);
      }
    }
  }

  return [...map.values()].map((m) => ({
    master: m.master,
    repairs: m.repairs,
    byBrand: [...m.byBrand.entries()].sort((a, b) => b[1] - a[1]),
    byModel: [...m.byModel.entries()].sort((a, b) => b[1] - a[1]),
    repeatsAfter: m.repeatsAfter,
    repeatRate: m.repairs ? (m.repeatsAfter / m.repairs) * 100 : 0,
    avgDaysClaimToRepair: m.gaps.length ? average(m.gaps) : null,
    returnedImeis: [...m.returnedImeis]
  })).sort((a, b) => b.repairs - a.repairs);
}

/** Обчислює зведені KPI для дашборду. */
function computeKpis(records, imeiAgg) {
  const totalRepairs = imeiAgg.reduce((s, r) => s + r.repairCount, 0);
  const totalClaims = imeiAgg.reduce((s, r) => s + r.claimCount, 0);
  const problemImei = imeiAgg.filter((r) => r.problem);
  const returnDays = imeiAgg.map((r) => r.daysSaleToReturn).filter((v) => v !== null);
  const repairGaps = imeiAgg.map((r) => r.avgDaysBetweenRepairs).filter((v) => v !== null);

  const models = aggregateByModel(imeiAgg);
  const owners = aggregateByOwner(imeiAgg);
  const masters = aggregateByMaster(records).filter((m) => m.repairs >= 2);

  const MIN_SAMPLE = 5;
  const significantModels = models.filter((m) => m.total >= MIN_SAMPLE);
  const mostRepairsOwner = [...owners].sort((a, b) => b.repairs - a.repairs)[0] || null;

  return {
    totalRecords: records.length,
    uniqueImei: imeiAgg.length,
    problemImei: problemImei.length,
    totalRepairs,
    totalClaims,
    avgRepairsPerImei: imeiAgg.length ? totalRepairs / imeiAgg.length : 0,
    avgDaysSaleToReturn: returnDays.length ? average(returnDays) : null,
    avgDaysBetweenRepairs: repairGaps.length ? average(repairGaps) : null,
    imei2plus: imeiAgg.filter((r) => r.repairCount >= 2).length,
    imei3plus: imeiAgg.filter((r) => r.repairCount >= 3).length,
    worstModel: significantModels[0] || models[0] || null,
    worstOwner: mostRepairsOwner,
    worstMaster: masters.sort((a, b) => b.repeatRate - a.repeatRate)[0] || null
  };
}
