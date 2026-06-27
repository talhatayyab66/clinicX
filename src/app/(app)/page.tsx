import { redirect } from "next/navigation";
import { getProfile, getSettings } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/format";
import type { Medicine } from "@/lib/types";

export default async function Dashboard() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role === "dispenser") redirect("/dispense");

  const settings = await getSettings();
  const supabase = createClient();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const iso = startOfDay.toISOString();
  const today = startOfDay.toISOString().slice(0, 10);

  const [visitsToday, receiptsToday, meds] = await Promise.all([
    supabase
      .from("visits")
      .select("id", { count: "exact", head: true })
      .gte("visit_date", iso),
    supabase.from("receipts").select("grand_total").gte("created_at", iso),
    supabase.from("medicines").select("*").eq("is_active", true),
  ]);

  const income = (receiptsToday.data ?? []).reduce(
    (s, r: { grand_total: number }) => s + Number(r.grand_total || 0),
    0
  );

  const medicines = (meds.data ?? []) as Medicine[];
  const lowStock = medicines.filter((m) => m.stock_qty <= (m.reorder_level ?? 10));
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const expiring = medicines.filter(
    (m) => m.expiry_date && m.expiry_date <= in30.toISOString().slice(0, 10)
  );

  // admin-only: today's expenses
  let expensesToday = 0;
  if (profile.role === "admin") {
    const { data } = await supabase
      .from("expenses")
      .select("amount")
      .eq("expense_date", today);
    expensesToday = (data ?? []).reduce(
      (s, e: { amount: number }) => s + Number(e.amount || 0),
      0
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Patients today" value={String(visitsToday.count ?? 0)} />
        <Stat label="Income today" value={money(income, settings)} />
        {profile.role === "admin" && (
          <Stat label="Expenses today" value={money(expensesToday, settings)} />
        )}
        <Stat label="Low-stock items" value={String(lowStock.length)} tone="warn" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-semibold">Low / out of stock</h2>
          {lowStock.length === 0 ? (
            <p className="text-sm text-gray-400">All medicines above reorder level.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Stock</th>
                  <th>Reorder ≤</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>
                      <span
                        className={`badge ${
                          m.stock_qty === 0
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {m.stock_qty}
                      </span>
                    </td>
                    <td>{m.reorder_level}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <h2 className="mb-3 font-semibold">Expiring within 30 days</h2>
          {expiring.length === 0 ? (
            <p className="text-sm text-gray-400">Nothing expiring soon.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Batch</th>
                  <th>Expiry</th>
                </tr>
              </thead>
              <tbody>
                {expiring.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{m.batch_no || "—"}</td>
                    <td className="text-red-600">{m.expiry_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
  tone?: "warn";
}) {
  return (
    <div className="card">
      <div className="text-sm text-gray-500">{label}</div>
      <div
        className={`mt-1 text-2xl font-bold ${
          tone === "warn" ? "text-amber-600" : "text-gray-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
