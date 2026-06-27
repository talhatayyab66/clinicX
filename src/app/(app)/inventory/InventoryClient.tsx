"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";
import type { Medicine, Settings } from "@/lib/types";

const EMPTY = {
  id: "",
  name: "",
  generic_name: "",
  form: "",
  strength: "",
  price: "0",
  stock_qty: "0",
  batch_no: "",
  expiry_date: "",
  reorder_level: "10",
};

export default function InventoryClient({
  isAdmin,
  settings,
}: {
  isAdmin: boolean;
  settings: Settings | null;
}) {
  const supabase = createClient();
  const [meds, setMeds] = useState<Medicine[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<typeof EMPTY | null>(null);
  const [restockFor, setRestockFor] = useState<Medicine | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("medicines").select("*").order("name");
    setMeds((data ?? []) as Medicine[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = meds.filter(
    (m) =>
      !q ||
      m.name.toLowerCase().includes(q.toLowerCase()) ||
      (m.generic_name ?? "").toLowerCase().includes(q.toLowerCase())
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory</h1>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setEditing({ ...EMPTY })}>
            Add medicine
          </button>
        )}
      </div>

      <input
        className="input mb-4 max-w-md"
        placeholder="Search medicines"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Form / Strength</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Batch</th>
              <th>Expiry</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center text-gray-400">Loading…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-gray-400">No medicines.</td>
              </tr>
            ) : (
              filtered.map((m) => {
                const low = m.stock_qty <= (m.reorder_level ?? 10);
                const expired = m.expiry_date && m.expiry_date < today;
                return (
                  <tr key={m.id}>
                    <td className="font-medium">
                      {m.name}
                      {m.generic_name && (
                        <div className="text-xs text-gray-400">{m.generic_name}</div>
                      )}
                    </td>
                    <td>
                      {m.form ?? "—"} {m.strength ? `· ${m.strength}` : ""}
                    </td>
                    <td>{money(m.price, settings)}</td>
                    <td>
                      <span
                        className={`badge ${
                          m.stock_qty === 0
                            ? "bg-red-100 text-red-700"
                            : low
                            ? "bg-amber-100 text-amber-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {m.stock_qty}
                      </span>
                    </td>
                    <td>{m.batch_no ?? "—"}</td>
                    <td className={expired ? "text-red-600 font-medium" : ""}>
                      {m.expiry_date ?? "—"}
                    </td>
                    {isAdmin && (
                      <td className="text-right">
                        <button
                          className="mr-3 text-brand-600 hover:underline"
                          onClick={() => setRestockFor(m)}
                        >
                          Restock
                        </button>
                        <button
                          className="text-gray-600 hover:underline"
                          onClick={() =>
                            setEditing({
                              id: m.id,
                              name: m.name,
                              generic_name: m.generic_name ?? "",
                              form: m.form ?? "",
                              strength: m.strength ?? "",
                              price: String(m.price),
                              stock_qty: String(m.stock_qty),
                              batch_no: m.batch_no ?? "",
                              expiry_date: m.expiry_date ?? "",
                              reorder_level: String(m.reorder_level ?? 10),
                            })
                          }
                        >
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <MedicineModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {restockFor && (
        <RestockModal
          medicine={restockFor}
          onClose={() => setRestockFor(null)}
          onSaved={() => {
            setRestockFor(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function MedicineModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: typeof EMPTY;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isNew = !form.id;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      generic_name: form.generic_name || null,
      form: form.form || null,
      strength: form.strength || null,
      price: Number(form.price || 0),
      batch_no: form.batch_no || null,
      expiry_date: form.expiry_date || null,
      reorder_level: Number(form.reorder_level || 10),
      ...(isNew ? { stock_qty: Number(form.stock_qty || 0) } : {}),
    };
    const res = isNew
      ? await supabase.from("medicines").insert(payload)
      : await supabase.from("medicines").update(payload).eq("id", form.id);
    setSaving(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    onSaved();
  }

  return (
    <Modal title={isNew ? "Add medicine" : "Edit medicine"} onClose={onClose}>
      <form onSubmit={save} className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Name *</label>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className="label">Generic name</label>
          <input className="input" value={form.generic_name} onChange={(e) => setForm({ ...form, generic_name: e.target.value })} />
        </div>
        <div>
          <label className="label">Form</label>
          <input className="input" placeholder="tablet, syrup…" value={form.form} onChange={(e) => setForm({ ...form, form: e.target.value })} />
        </div>
        <div>
          <label className="label">Strength</label>
          <input className="input" placeholder="500mg" value={form.strength} onChange={(e) => setForm({ ...form, strength: e.target.value })} />
        </div>
        <div>
          <label className="label">Price</label>
          <input type="number" step="0.01" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </div>
        {isNew && (
          <div>
            <label className="label">Opening stock</label>
            <input type="number" className="input" value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} />
          </div>
        )}
        <div>
          <label className="label">Batch #</label>
          <input className="input" value={form.batch_no} onChange={(e) => setForm({ ...form, batch_no: e.target.value })} />
        </div>
        <div>
          <label className="label">Expiry date</label>
          <input type="date" className="input" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
        </div>
        <div>
          <label className="label">Reorder level</label>
          <input type="number" className="input" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
        </div>
        {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
        <div className="col-span-2 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}

function RestockModal({
  medicine,
  onClose,
  onSaved,
}: {
  medicine: Medicine;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("restock");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await supabase.rpc("restock_medicine", {
      p_medicine_id: medicine.id,
      p_qty: Number(qty),
      p_reason: reason,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  }

  return (
    <Modal title={`Restock — ${medicine.name}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <p className="text-sm text-gray-500">Current stock: {medicine.stock_qty}</p>
        <div>
          <label className="label">Quantity to add</label>
          <input type="number" min="1" className="input" required value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div>
          <label className="label">Reason</label>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Add stock"}</button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="mt-10 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
