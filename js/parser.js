// Парсер ієрархічного 1С-звіту "Партії товарів / рух собівартості" (.xls/.xlsx)
// у плоский список записів гарантійних обмінів з повною таймлайн-історією подій.

const DOC_TYPE_PREFIXES = [
  ["Оприбуткування запасів", "receipt"],
  ["Чек ККМ", "sale"],
  ["Видаткова накладна", "transferOut"],
  ["Прибуткова накладна", "transferIn"],
  ["Виробництво", "production"],
  ["Списання запасів", "writeoff"]
];

const QUALIFIER_WORDS = new Set(["pro", "max", "mini", "plus", "ultra"]);
const MULTI_WORD_CITIES = ["Кривий Ріг", "Біла Церква"];

function parseDocLine(text) {
  const m = text.match(/^(.*?)\s+(\S+)\s+від\s+(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return null;
  const prefix = m[1].trim();
  for (const [p, type] of DOC_TYPE_PREFIXES) {
    if (prefix.startsWith(p)) {
      return {
        type,
        docNumber: m[2],
        date: `${m[5]}-${m[4]}-${m[3]}`
      };
    }
  }
  return null;
}

/** "11 Pro Max 256 silver used" / "Смартфон Samsung Galaxy S24 Ultra 12/256GB Titanium Black used" */
function parseProduct(raw) {
  let s = String(raw || "").trim();
  const eSim = /\(eSim\)/i.test(s);
  s = s.replace(/\(eSim\)/gi, "").replace(/\bused\b/gi, "").trim();

  if (/^Смартфон\s+/i.test(s)) {
    const rest = s.replace(/^Смартфон\s+/i, "");
    const tokens = rest.split(/\s+/).filter(Boolean);
    const brand = tokens[0] || "Інше";
    let memIdx = tokens.findIndex((t) => /(\d+\/)?\d+\s*GB/i.test(t));
    let model, memory, color;
    if (memIdx >= 0) {
      const m = tokens[memIdx].match(/(?:\d+\/)?(\d+)\s*GB/i);
      memory = `${m[1]}GB`;
      model = tokens.slice(1, memIdx).join(" ");
      color = tokens.slice(memIdx + 1).join(" ");
    } else {
      model = tokens.slice(1).join(" ");
      memory = null;
      color = "";
    }
    return { brand, model: model || "Інше", memory, color: color || null, eSim };
  }

  // Apple ("11 128 black used", "12 mini 64 black used", "13 Pro 1ТB Graphite used", "Xs 256 gold used")
  const tokens = s.split(/\s+/).filter(Boolean);
  if (!tokens.length) return { brand: "Інше", model: "Невідома модель", memory: null, color: null, eSim };

  let i = 1;
  const qualifiers = [];
  while (i < tokens.length && QUALIFIER_WORDS.has(tokens[i].toLowerCase())) {
    const w = tokens[i].toLowerCase();
    qualifiers.push(w === "max" ? "Max" : w[0].toUpperCase() + w.slice(1));
    i++;
  }

  let memory = null;
  if (i < tokens.length) {
    const memMatch = tokens[i].match(/^(\d+)\s*(ТB|TB|GB)?$/i);
    if (memMatch) {
      const unit = (memMatch[2] || "GB").toUpperCase().replace("ТB", "TB");
      memory = `${memMatch[1]}${unit}`;
      i++;
    }
  }

  const color = tokens.slice(i).join(" ") || null;
  const model = `iPhone ${tokens[0]}${qualifiers.length ? " " + qualifiers.join(" ") : ""}`;

  return { brand: "Apple", model, memory, color, eSim };
}

/** Виводить місто та назву магазину зі складу оприходування. */
function parseStoreCity(warehouseRaw) {
  const s = String(warehouseRaw || "").trim();
  if (!s) return { city: null, store: null };
  if (/^Відділ інтернет/i.test(s)) return { city: "Інтернет-магазин", store: s };

  const m = s.match(/^(Ябко|Appleroom)\s+(.+)$/);
  if (!m) return { city: "Інше", store: s };

  const rest = m[2];
  for (const city of MULTI_WORD_CITIES) {
    if (rest.startsWith(city)) return { city, store: s };
  }
  const firstWord = rest.split(/\s+/)[0].replace(/[()]/g, "");
  return { city: firstWord || "Інше", store: s };
}

function enrichRecord(rec) {
  rec.events.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const { brand, model, memory, color } = parseProduct(rec.productRaw);
  rec.brand = brand;
  rec.model = model;
  rec.memory = memory;
  rec.color = color;
  rec.category = "Смартфон";

  const firstReceipt = rec.events.find((e) => e.type === "receipt");
  if (firstReceipt) {
    const { city, store } = parseStoreCity(firstReceipt.warehouse);
    rec.store = store;
    rec.city = city;
    rec.batchDoc = firstReceipt.docNumber;
  } else {
    rec.store = null;
    rec.city = null;
    rec.batchDoc = null;
  }

  const sales = rec.events.filter((e) => e.type === "sale");
  rec.saleDate = sales.length ? sales[0].date : null;
  rec.lastSaleDate = sales.length ? sales[sales.length - 1].date : null;

  const receipts = rec.events.filter((e) => e.type === "receipt");
  rec.claims = rec.saleDate
    ? receipts.filter((e) => e.date && e.date > rec.saleDate)
    : receipts.slice(1);
  rec.claimDates = rec.claims.map((e) => e.date).filter(Boolean);
  rec.firstClaimDate = rec.claimDates[0] || null;

  const repairs = rec.events.filter((e) => e.type === "production");
  rec.repairDates = repairs.map((e) => e.date).filter(Boolean);
  rec.repairMasters = repairs.map((e) => e.repairMaster).filter(Boolean);
  rec.repairCount = repairs.length;
  rec.claimCount = rec.claimDates.length;
  rec.receiptCount = receipts.length;

  rec.date = rec.firstClaimDate || rec.saleDate || (rec.events[0] && rec.events[0].date) || null;
  rec.status = "Завершено";

  rec.dedupKey = `${rec.imei}|${rec.reason}|${rec.events[0] ? rec.events[0].docNumber : ""}`;
  return rec;
}

/** rows: масив масивів значень (SheetJS sheet_to_json з header:1) */
function parseRows(rows) {
  const records = [];
  let currentProduct = null;
  let currentRecord = null;

  for (let r = 3; r < rows.length; r++) {
    const row = rows[r] || [];
    const col0 = String(row[0] ?? "").trim();
    const col1 = String(row[1] ?? "").trim();
    if (!col0) continue;

    const doc = parseDocLine(col0);
    if (doc) {
      if (currentRecord) {
        currentRecord.events.push({
          ...doc,
          warehouse: String(row[3] ?? "").trim() || undefined,
          repairMaster: String(row[11] ?? "").trim() || undefined,
          costValue: row[5] !== "" && row[5] != null ? Number(row[5]) : undefined,
          repairCost: row[6] !== "" && row[6] != null ? Number(row[6]) : undefined
        });
      }
      continue;
    }

    const qty = row[4];
    if (col0 === "Разом") {
      currentRecord = null;
      continue;
    }
    if (col1 === "" && qty !== "" && qty != null) {
      currentProduct = col0;
      currentRecord = null;
      continue;
    }

    // Рядок-характеристика (IMEI) -> новий запис гарантійного обміну
    currentRecord = {
      productRaw: currentProduct,
      imei: col0,
      owner: col1 || null,
      reason: String(row[2] ?? "").trim() || null,
      qty: row[4] != null && row[4] !== "" ? Number(row[4]) : null,
      repairCostTotal: row[6] !== "" && row[6] != null ? Number(row[6]) : null,
      costStart: row[7] !== "" && row[7] != null ? Number(row[7]) : null,
      costEnd: row[8] !== "" && row[8] != null ? Number(row[8]) : null,
      diff: row[9] !== "" && row[9] != null ? Number(row[9]) : null,
      manager: String(row[10] ?? "").trim() || null,
      repairMaster: String(row[11] ?? "").trim() || null,
      events: []
    };
    records.push(currentRecord);
  }

  return records.map(enrichRecord);
}

/** Парсить ArrayBuffer .xls/.xlsx через глобальний XLSX (SheetJS, підключений у index.html). */
function parseWorkbookBuffer(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
  return parseRows(rows);
}
