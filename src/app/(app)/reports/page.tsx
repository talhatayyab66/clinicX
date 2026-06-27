import { redirect } from "next/navigation";
import { getProfile, getSettings } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/format";
import type { Settings } from "@/lib/types";
import ReportToolbar from "./ReportToolbar";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const isAdmin = profile.role === "admin";
  const settings = (await getSettings()) as Settings | null;
  const supabase = createClient();

  // default range: this month to date
  const now = new Date();
  const defFrom = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const defTo = now.toISOString().slice(0, 10);
  const from = searchParams.from ?? defFrom;
  const to = searchParams.to ?? defTo;
  const toEnd = `${to}T23:59:59`;

  const [{ data: receipts }, { data: di }, { data: visits }, { data: meds }] =
    await Promise.all([
      supabase
        .from("receipts")
        .select("grand_total, consultation_fee, medicines_total, created_at")
        .gte("created_at", from)
        .lte("created_at", toEnd),
      supabase
        .from("dispense_items")
        .select("qty, line_total, medicines(name)"),
      supabase
        .from("visits")
        .select("diagnosis")
        .gte("visit_date", from)
        .lte("visit_date", toEnd),
      supabase.from("medicines").select("name, stock_qty, reorder_level, is_active"),
    ]);

  const income = (receipts ?? []).reduce(
    (s, r: { grand_total: number }) => s + Number(r.grand_total || 0),
    0
  );

  let expenseTotal = 0;
  if (isAdmin) {
    const { data: exp } = await supabase
      .from("expenses")
      .select("amount")
      .gte("expense_date", from)
      .lte("expense_date", to);
    expenseTotal = (exp ?? []).reduce(
      (s, e: { amount: number }) => s + Number(e.amount || 0),
      0
    );
  }

  // top medicines by qty dispensed
  const medMap = new Map<string, { qty: number; revenue: number }>();
  for (const row of (di ?? []) as unknown as Array<{
    qty: number;
    line_total: number;
    medicines: { name: string } | { name: string }[] | null;
  }>) {
    const med = Array.isArray(row.medicines) ? row.medicines[0] : row.medicines;
    const name = med?.name ?? "Unknown";
    const cur = medMap.get(name) ?? { qty: 0, revenue: 0 };
    cur.qty += Number(row.qty || 0);
    cur.revenue += Number(row.line_total || 0);
    medMap.set(name, cur);
  }
  const topMeds = [...medMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  // top diagnoses
  const dxMap = new Map<string, number>();
  for (const v of (visits ?? []) as Array<{ diagnosis: string | null }>) {
    const d = (v.diagnosis ?? "").trim();
    if (!d) continue;
    dxMap.set(d, (dxMap.get(d) ?? 0) + 1);
  }
  const topDx = [...dxMap.entries()]
    .map(([diagnosis, count]) => ({ diagnosis, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const lowStock = ((meds ?? []) as Array<{
    name: string;
    stock_qty: number;
    reorder_level: number;
    is_active: boolean;
  }>).filter((m) => m.is_active && m.stock_qty <= (m.reorder_level ?? 10));

  return (
    <div>
      <div className="mb-6 flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <h1 className="text-2xl font-bold">Reports</h1>
        <ReportToolbar
          from={from}
          to={to}
          topMeds={topMeds}
          topDx={topDx}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Income" value={money(income, settings)} />
        {isAdmin && <Stat label="Expenses" value={money(expenseTotal, settings)} />}
        {isAdmin && (
          <Stat
            label="Net"
            value={money(income - expenseTotal, settings)}
            tone={income - expenseTotal >= 0 ? "good" : "bad"}
          />
        )}
        <Stat label="Visits" value={String((visits ?? []).length)} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-semibold">Top medicines</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Medicine</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topMeds.length === 0 ? (
                <tr><td colSpan={3} className="text-center text-gray-400">No data.</td></tr>
              ) : (
                topMeds.map((m) => (
                  <tr key={m.name}>
                    <td>{m.name}</td>
                    <td className="text-right">{m.qty}</td>
                    <td className="text-right">{money(m.revenue, settings)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2 className="mb-3 font-semibold">Top diagnoses</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Diagnosis</th>
                <th className="text-right">Count</th>
              </tr>
            </thead>
            <tbody>
              {topDx.length === 0 ? (
                <tr><td colSpan={2} className="text-center text-gray-400">No data.</td></tr>
              ) : (
                topDx.map((d) => (
                  <tr key={d.diagnosis}>
                    <td>{d.diagnosis}</td>
                    <td className="text-right">{d.count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="card lg:col-span-2">
          <h2 className="mb-3 font-semibold">Low / out of stock</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Medicine</th>
                <th className="text-right">Stock</th>
                <th className="text-right">Reorder ≤</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.length === 0 ? (
                <tr><td colSpan={3} className="text-center text-gray-400">All good.</td></tr>
              ) : (
                lowStock.map((m) => (
                  <tr key={m.name}>
                    <td>{m.name}</td>
                    <td className="text-right">{m.stock_qty}</td>
                    <td className="text-right">{m.reorder_level}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="card">
      <div className="text-sm text-gray-500">{label}</div>
      <div
        className={`mt-1 text-2xl font-bold ${
          tone === "good" ? "text-green-600" : tone === "bad" ? "text-red-600" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
