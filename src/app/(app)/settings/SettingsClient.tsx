"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Settings } from "@/lib/types";

export default function SettingsClient({ settings }: { settings: Settings | null }) {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({
    clinic_name: settings?.clinic_name ?? "",
    address: settings?.address ?? "",
    phone: settings?.phone ?? "",
    email: settings?.email ?? "",
    currency: settings?.currency ?? "USD",
    currency_symbol: settings?.currency_symbol ?? "$",
    region: settings?.region ?? "US",
    tax_rate: String(settings?.tax_rate ?? 0),
    logo_url: settings?.logo_url ?? "",
    receipt_footer: settings?.receipt_footer ?? "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setError(null);
    const { error } = await supabase.from("settings").upsert(
      {
        id: 1,
        clinic_name: form.clinic_name || null,
        address: form.address || null,
        phone: form.phone || null,
        email: form.email || null,
        currency: form.currency,
        currency_symbol: form.currency_symbol,
        region: form.region,
        tax_rate: Number(form.tax_rate || 0),
        logo_url: form.logo_url || null,
        receipt_footer: form.receipt_footer || null,
      },
      { onConflict: "id" }
    );
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMsg("Settings saved.");
    router.refresh();
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>
      <form onSubmit={save} className="card grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label">Clinic name</label>
          <input className="input" value={form.clinic_name} onChange={(e) => setForm({ ...form, clinic_name: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Address</label>
          <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label">Logo URL</label>
          <input className="input" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
        </div>
        <div>
          <label className="label">Currency code</label>
          <input className="input" placeholder="USD" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
        </div>
        <div>
          <label className="label">Currency symbol</label>
          <input className="input" placeholder="$" value={form.currency_symbol} onChange={(e) => setForm({ ...form, currency_symbol: e.target.value })} />
        </div>
        <div>
          <label className="label">Region / locale</label>
          <input className="input" placeholder="US, GB, PK…" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
        </div>
        <div>
          <label className="label">Tax rate (%)</label>
          <input type="number" step="0.01" className="input" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Receipt footer</label>
          <input className="input" value={form.receipt_footer} onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })} />
        </div>

        {msg && <p className="text-sm text-green-600 md:col-span-2">{msg}</p>}
        {error && <p className="text-sm text-red-600 md:col-span-2">{error}</p>}

        <div className="md:col-span-2">
          <button className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
