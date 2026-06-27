"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportToolbar({
  from,
  to,
  topMeds,
  topDx,
}: {
  from: string;
  to: string;
  topMeds: { name: string; qty: number; revenue: number }[];
  topDx: { diagnosis: string; count: number }[];
}) {
  const router = useRouter();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);

  function apply() {
    router.push(`/reports?from=${f}&to=${t}`);
  }

  function exportExcel() {
    // Excel opens CSV natively; we export both tables.
    const meds = toCSV(topMeds);
    const dx = toCSV(topDx);
    download(`report_${from}_${to}.csv`, `Top medicines\n${meds}\n\nTop diagnoses\n${dx}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-2 no-print">
      <div>
        <label className="label">From</label>
        <input type="date" className="input" value={f} onChange={(e) => setF(e.target.value)} />
      </div>
      <div>
        <label className="label">To</label>
        <input type="date" className="input" value={t} onChange={(e) => setT(e.target.value)} />
      </div>
      <button className="btn-secondary" onClick={apply}>Apply</button>
      <button className="btn-secondary" onClick={() => window.print()}>Export PDF</button>
      <button className="btn-secondary" onClick={exportExcel}>Export Excel</button>
    </div>
  );
}
