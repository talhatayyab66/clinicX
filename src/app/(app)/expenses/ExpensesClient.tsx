"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { money, fmtDate } from "@/lib/format";
import type { Expense, Settings } from "@/lib/types";

const CATEGORIES = ["rent", "salaries", "utilities", "restock", "misc"];

export default function ExpensesClient({ settings }: { settings: Settings | null }) {
  const supabase = createClient();
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    category: "misc",
    description: "",
    amount: "",
    expense_date: new Date().toISOString().slice(0, 10),
  });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .limit(200);
    setItems((data ?? []) as Expense[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("expenses").insert({
      category: form.category,
      description: form.description || null,
      amount: Number(form.amount || 0),
      expense_date: form.expense_date,
      created_by: user?.id ?? null,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setForm({ ...form, description: "", amount: "" });
    load();
  }

  const total = items.reduce((s, e) => s + Number(e.amount || 0), 0);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Expenses</h1>

      <form onSubmit={add} className="card mb-6 grid grid-cols-1 gap-4 md:grid-cols-5">
        <div>
          <label className="label">Category</label>
          <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => (
              <option key={c} className="capitalize">{c}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Description</label>
          <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <label className="label">Amount</label>
          <input type="number" step="0.01" required className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
        <div>
          <label className="label">Date</label>
          <input type="date" className="input" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
        </div>
        {error && <p className="text-sm text-red-600 md:col-span-5">{error}</p>}
        <div className="md:col-span-5">
          <button className="btn-primary">Add expense</button>
        </div>
      </form>

      <div className="card overflow-x-auto">
        <div className="mb-3 flex justify-between">
          <h2 className="font-semibold">Recent expenses</h2>
          <span className="text-sm text-gray-500">
            Total: <strong>{money(total, settings)}</strong>
          </span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center text-gray-400">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="text-center text-gray-400">No expenses recorded.</td></tr>
            ) : (
              items.map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(e.expense_date, settings)}</td>
                  <td className="capitalize">{e.category}</td>
                  <td>{e.description ?? "—"}</td>
                  <td className="text-right">{money(e.amount, settings)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
