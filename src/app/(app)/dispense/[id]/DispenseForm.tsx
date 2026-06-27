"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";
import type { Settings } from "@/lib/types";

interface Item {
  medicine_id: string;
  name: string;
  strength: string;
  unit_price: number;
  stock_qty: number;
  qty: number;
}

export default function DispenseForm({
  visitId,
  consultationFee,
  items: initialItems,
  settings,
}: {
  visitId: string;
  consultationFee: number;
  items: Item[];
  settings: Settings | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState<Item[]>(initialItems);
  const [payment, setPayment] = useState("cash");
  const [received, setReceived] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const taxRate = Number(settings?.tax_rate ?? 0);

  const medsTotal = useMemo(
    () => items.reduce((s, it) => s + it.unit_price * (it.qty || 0), 0),
    [items]
  );
  const tax = useMemo(
    () => Math.round(((medsTotal + consultationFee) * taxRate) / 100 * 100) / 100,
    [medsTotal, consultationFee, taxRate]
  );
  const grand = medsTotal + consultationFee + tax;
  const change = Math.max(0, Number(received || 0) - grand);

  function setQty(i: number, qty: number) {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, qty } : it)));
  }

  async function dispense() {
    setError(null);
    // client-side stock guard (server RPC also enforces this)
    for (const it of items) {
      if (it.qty > it.stock_qty) {
        setError(`Insufficient stock for ${it.name} (have ${it.stock_qty}).`);
        return;
      }
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("dispense_visit", {
      p_visit_id: visitId,
      p_items: items
        .filter((it) => it.qty > 0)
        .map((it) => ({
          medicine_id: it.medicine_id,
          qty: it.qty,
          unit_price: it.unit_price,
        })),
      p_payment_method: payment,
      p_amount_received: Number(received || 0),
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(`/receipts/${data as string}`);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="card lg:col-span-2 overflow-x-auto">
        <h2 className="mb-3 font-semibold">Items to dispense</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Unit price</th>
              <th>Stock</th>
              <th>Qty</th>
              <th>Line total</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-gray-400">
                  No medicines prescribed.
                </td>
              </tr>
            ) : (
              items.map((it, i) => (
                <tr key={it.medicine_id + i}>
                  <td className="font-medium">
                    {it.name} {it.strength}
                  </td>
                  <td>{money(it.unit_price, settings)}</td>
                  <td>
                    <span
                      className={
                        it.qty > it.stock_qty ? "text-red-600 font-medium" : ""
                      }
                    >
                      {it.stock_qty}
                    </span>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className="input w-20"
                      value={it.qty}
                      onChange={(e) => setQty(i, Number(e.target.value))}
                    />
                  </td>
                  <td>{money(it.unit_price * (it.qty || 0), settings)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="card h-fit">
        <h2 className="mb-3 font-semibold">Payment</h2>
        <dl className="space-y-1 text-sm">
          <Row k="Consultation" v={money(consultationFee, settings)} />
          <Row k="Medicines" v={money(medsTotal, settings)} />
          {taxRate > 0 && <Row k={`Tax (${taxRate}%)`} v={money(tax, settings)} />}
          <div className="my-2 border-t border-gray-200" />
          <Row k="Grand total" v={money(grand, settings)} bold />
        </dl>

        <div className="mt-4 space-y-3">
          <div>
            <label className="label">Payment method</label>
            <select
              className="input"
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="mobile">Mobile</option>
            </select>
          </div>
          <div>
            <label className="label">Amount received</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={received}
              onChange={(e) => setReceived(e.target.value)}
            />
          </div>
          <Row k="Change due" v={money(change, settings)} bold />
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          className="btn-primary mt-4 w-full"
          onClick={dispense}
          disabled={busy}
        >
          {busy ? "Processing…" : "Dispense & generate receipt"}
        </button>
      </div>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold text-base" : ""}`}>
      <dt className="text-gray-500">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
