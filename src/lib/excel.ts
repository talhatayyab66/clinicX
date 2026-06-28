// xlsx is heavy (~140kB) — load it on demand so it never weighs down the
// inventory page until the user actually imports/exports.
async function loadXLSX() {
  return import("xlsx");
}

export interface MedicineRow {
  name: string;
  generic_name: string | null;
  form: string | null;
  strength: string | null;
  price: number;
  stock_qty: number;
  batch_no: string | null;
  expiry_date: string | null;
  reorder_level: number;
}

const HEADERS = [
  "name",
  "generic_name",
  "form",
  "strength",
  "price",
  "stock_qty",
  "batch_no",
  "expiry_date",
  "reorder_level",
];

/** Build and download a sample .xlsx the doctor can fill in. */
export async function downloadMedicineTemplate() {
  const XLSX = await loadXLSX();
  const example = [
    {
      name: "Paracetamol",
      generic_name: "Acetaminophen",
      form: "tablet",
      strength: "500mg",
      price: 0.1,
      stock_qty: 500,
      batch_no: "B-PARA-01",
      expiry_date: "2027-01-31",
      reorder_level: 50,
    },
    {
      name: "Amoxicillin",
      generic_name: "Amoxicillin",
      form: "capsule",
      strength: "250mg",
      price: 0.25,
      stock_qty: 300,
      batch_no: "B-AMOX-01",
      expiry_date: "2026-12-31",
      reorder_level: 40,
    },
  ];
  const ws = XLSX.utils.json_to_sheet(example, { header: HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Medicines");
  XLSX.writeFile(wb, "clinicx_medicines_template.xlsx");
}

function toStr(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  return String(v).trim();
}

function toNum(v: unknown, fallback = 0): number {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toDate(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  // Excel may give a Date object or a serial number; XLSX with cellDates
  // returns Dates. Normalise to YYYY-MM-DD.
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
}

/** Parse an uploaded .xlsx/.csv into validated medicine rows. */
export async function parseMedicineWorkbook(file: File): Promise<MedicineRow[]> {
  const XLSX = await loadXLSX();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  const rows: MedicineRow[] = [];
  for (const r of raw) {
    // tolerate different header casing / spacing
    const get = (key: string) => {
      const found = Object.keys(r).find(
        (k) => k.toLowerCase().trim().replace(/\s+/g, "_") === key
      );
      return found ? r[found] : undefined;
    };
    const name = toStr(get("name"));
    if (!name) continue; // skip blank rows
    rows.push({
      name,
      generic_name: toStr(get("generic_name")),
      form: toStr(get("form")),
      strength: toStr(get("strength")),
      price: toNum(get("price")),
      stock_qty: toNum(get("stock_qty")),
      batch_no: toStr(get("batch_no")),
      expiry_date: toDate(get("expiry_date")),
      reorder_level: toNum(get("reorder_level"), 10),
    });
  }
  return rows;
}
