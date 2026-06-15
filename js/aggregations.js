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

function average(arr) {
  const vals = arr.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
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
    result.push({
      imei: g.imei,
      productRaw: first.productRaw,
      brand: first.brand,
      model: first.model,
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

/** Групує записи за власником партії (джерело надходження товару). */
function aggregateByOwner(records) {
  const map = new Map();
  for (const r of records) {
    const key = r.owner || "Невідомо";
    if (!map.has(key)) map.set(key, { owner: key, items: [] });
    map.get(key).items.push(r);
  }
  return [...map.values()].map(({ owner, items }) => {
    const total = items.length;
    const repairs = items.reduce((s, r) => s + (r.repairCount || 0), 0);
    const claims = items.reduce((s, r) => s + (r.claimCount || 0), 0);
    const problematic = items.filter((r) => (r.repairCount || 0) > 0 || (r.claimCount || 0) > 0).length;
    return {
      owner,
      total,
      repairs,
      claims,
      problemRate: total ? (problematic / total) * 100 : 0
    };
  }).sort((a, b) => b.total - a.total);
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
        map.set(key, { master: key, repairs: 0, byBrand: new Map(), byModel: new Map(), repeatsAfter: 0, gaps: [] });
      }
      const m = map.get(key);
      m.repairs++;
      m.byBrand.set(r.brand, (m.byBrand.get(r.brand) || 0) + 1);
      m.byModel.set(r.model, (m.byModel.get(r.model) || 0) + 1);

      const later = sorted.slice(i + 1).some(
        (ev) => ev.date && e.date && ev.date > e.date && (ev.type === "receipt" || ev.type === "production")
      );
      if (later) m.repeatsAfter++;

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
    avgDaysClaimToRepair: m.gaps.length ? average(m.gaps) : null
  })).sort((a, b) => b.repairs - a.repairs);
}
