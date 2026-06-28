"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calcQty } from "@/lib/types";
import Autocomplete from "@/components/Autocomplete";
import MedicineSelect from "@/components/MedicineSelect";
import { COMPLAINTS, DIAGNOSES, CO_MORBS } from "@/lib/clinicalData";
import type {
  Frequency,
  Medicine,
  Patient,
  Prescription,
  Settings,
  Visit,
  Vitals,
} from "@/lib/types";

const FREQS: Frequency[] = ["OD", "BD", "TDS", "QID", "HS", "STAT", "SOS"];

interface RxRow {
  id?: string;
  medicine_id: string;
  dose: string;
  freq: Frequency;
  route: string;
  duration_days: string;
  before_after_food: string;
  qty_calculated: string;
  qtyTouched: boolean;
  instructions: string;
}

function toRow(p: Prescription): RxRow {
  return {
    id: p.id,
    medicine_id: p.medicine_id ?? "",
    dose: p.dose ?? "",
    freq: p.freq,
    route: p.route ?? "",
    duration_days: p.duration_days?.toString() ?? "",
    before_after_food: p.before_after_food ?? "",
    qty_calculated: p.qty_calculated?.toString() ?? "",
    qtyTouched: true,
    instructions: p.instructions ?? "",
  };
}

function blankRow(): RxRow {
  return {
    medicine_id: "",
    dose: "",
    freq: "OD",
    route: "oral",
    duration_days: "",
    before_after_food: "",
    qty_calculated: "",
    qtyTouched: false,
    instructions: "",
  };
}

export default function VisitEditor({
  visit,
  patient,
  medicines,
  initialRx,
  settings,
}: {
  visit: Visit;
  patient: Patient;
  medicines: Medicine[];
  initialRx: Prescription[];
  settings: Settings | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const readOnly = visit.status !== "open";

  const vit = visit.vitals ?? {};
  const [form, setForm] = useState({
    complaint: visit.complaint ?? "",
    diagnosis: visit.diagnosis ?? "",
    comorbidities: visit.comorbidities ?? "",
    notes: visit.notes ?? "",
    consultation_fee: visit.consultation_fee?.toString() ?? "0",
    bp: vit.bp ?? "",
    pulse: vit.pulse ?? "",
    temp: vit.temp ?? "",
    spo2: vit.spo2 ?? "",
  });
  const [rows, setRows] = useState<RxRow[]>(
    initialRx.length ? initialRx.map(toRow) : [blankRow()]
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // ----- co-morbidities (checkbox chips + free-text "other") -----
  const comorbTokens = form.comorbidities
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const selectedComorbs = CO_MORBS.filter((c) =>
    comorbTokens.some((t) => t.toLowerCase() === c.toLowerCase())
  );
  const otherComorb = comorbTokens
    .filter((t) => !CO_MORBS.some((c) => c.toLowerCase() === t.toLowerCase()))
    .join(", ");

  function setComorbs(selected: string[], other: string) {
    const others = other.split(",").map((s) => s.trim()).filter(Boolean);
    setForm({ ...form, comorbidities: [...selected, ...others].join(", ") });
  }
  function toggleComorb(c: string) {
    const next = selectedComorbs.some((x) => x.toLowerCase() === c.toLowerCase())
      ? selectedComorbs.filter((x) => x.toLowerCase() !== c.toLowerCase())
      : [...selectedComorbs, c];
    setComorbs(next, otherComorb);
  }

  function updateRow(i: number, patch: Partial<RxRow>) {
    setRows((rs) =>
      rs.map((r, idx) => {
        if (idx !== i) return r;
        const next = { ...r, ...patch };
        // auto-recalc qty unless manually overridden
        if (("freq" in patch || "duration_days" in patch) && !next.qtyTouched) {
          const q = calcQty(next.freq, next.duration_days ? Number(next.duration_days) : null);
          next.qty_calculated = q ? String(q) : "";
        }
        return next;
      })
    );
  }

  async function persist(): Promise<boolean> {
    const vitals: Vitals = {
      bp: form.bp || undefined,
      pulse: form.pulse || undefined,
      temp: form.temp || undefined,
      spo2: form.spo2 || undefined,
    };
    const { error: vErr } = await supabase
      .from("visits")
      .update({
        complaint: form.complaint || null,
        diagnosis: form.diagnosis || null,
        comorbidities: form.comorbidities || null,
        notes: form.notes || null,
        consultation_fee: Number(form.consultation_fee || 0),
        vitals,
      })
      .eq("id", visit.id);
    if (vErr) {
      setMsg(vErr.message);
      return false;
    }

    // replace prescriptions wholesale (simple + correct)
    await supabase.from("prescriptions").delete().eq("visit_id", visit.id);
    const valid = rows.filter((r) => r.medicine_id);
    if (valid.length) {
      const { error: rxErr } = await supabase.from("prescriptions").insert(
        valid.map((r) => ({
          visit_id: visit.id,
          medicine_id: r.medicine_id,
          dose: r.dose || null,
          freq: r.freq,
          route: r.route || null,
          duration_days: r.duration_days ? Number(r.duration_days) : null,
          before_after_food: r.before_after_food || null,
          qty_calculated: r.qty_calculated ? Number(r.qty_calculated) : null,
          instructions: r.instructions || null,
        }))
      );
      if (rxErr) {
        setMsg(rxErr.message);
        return false;
      }
    }
    return true;
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const ok = await persist();
    setSaving(false);
    if (ok) {
      setMsg("Saved.");
      router.refresh();
    }
  }

  async function discharge() {
    if (!confirm("Discharge this visit? It will move to the dispensing queue.")) return;
    setSaving(true);
    setMsg(null);
    const ok = await persist();
    if (!ok) {
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("visits")
      .update({ status: "discharged" })
      .eq("id", visit.id);
    setSaving(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3">
      <div className="flex flex-col items-start justify-between gap-2 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold">{patient?.name}</h1>
          <p className="text-sm text-gray-500">
            #{patient?.patient_no} · {patient?.gender ?? "—"} ·{" "}
            {patient?.age ? `${patient.age}y` : "—"} · Status:{" "}
            <span className="font-medium capitalize">{visit.status}</span>
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <a href={`/visits/${visit.id}/slip`} className="btn-secondary" target="_blank">
            Print slip
          </a>
        </div>
      </div>

      {patient?.allergies && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <strong>Allergies:</strong> {patient.allergies}
        </div>
      )}

      {readOnly && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
          This visit is {visit.status} and can no longer be edited.
        </div>
      )}

      {/* Vitals */}
      <section className="card mt-6">
        <h2 className="mb-3 font-semibold">Vitals</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="BP" value={form.bp} disabled={readOnly} onChange={(v) => setForm({ ...form, bp: v })} placeholder="120/80" />
          <Field label="Pulse" value={form.pulse} disabled={readOnly} onChange={(v) => setForm({ ...form, pulse: v })} placeholder="bpm" />
          <Field label="Temp" value={form.temp} disabled={readOnly} onChange={(v) => setForm({ ...form, temp: v })} placeholder="°C" />
          <Field label="SpO₂" value={form.spo2} disabled={readOnly} onChange={(v) => setForm({ ...form, spo2: v })} placeholder="%" />
        </div>
      </section>

      {/* Clinical */}
      <section className="card mt-6 space-y-4">
        <h2 className="font-semibold">Clinical notes</h2>
        <div>
          <label className="label">Complaint</label>
          <Autocomplete
            value={form.complaint}
            disabled={readOnly}
            options={COMPLAINTS}
            placeholder="Type to search complaints…"
            onChange={(v) => setForm({ ...form, complaint: v })}
          />
        </div>
        <div>
          <label className="label">Diagnosis</label>
          <Autocomplete
            value={form.diagnosis}
            disabled={readOnly}
            options={DIAGNOSES}
            placeholder="Type to search diagnoses…"
            onChange={(v) => setForm({ ...form, diagnosis: v })}
          />
        </div>
        <div>
          <label className="label">Co-morbidities</label>
          <div className="flex flex-wrap gap-2">
            {CO_MORBS.map((c) => {
              const checked = comorbTokens.some(
                (t) => t.toLowerCase() === c.toLowerCase()
              );
              return (
                <button
                  type="button"
                  key={c}
                  disabled={readOnly}
                  onClick={() => toggleComorb(c)}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    checked
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                  } disabled:opacity-60`}
                >
                  {checked ? "✓ " : ""}
                  {c}
                </button>
              );
            })}
          </div>
          <input
            className="input mt-2"
            disabled={readOnly}
            placeholder="Other co-morbidities (comma separated)"
            value={otherComorb}
            onChange={(e) => setComorbs(selectedComorbs, e.target.value)}
          />
        </div>
        <Area label="Notes" value={form.notes} disabled={readOnly} onChange={(v) => setForm({ ...form, notes: v })} />
        <div className="max-w-xs">
          <label className="label">Consultation fee ({settings?.currency_symbol ?? "$"})</label>
          <input
            type="number"
            step="0.01"
            className="input"
            disabled={readOnly}
            value={form.consultation_fee}
            onChange={(e) => setForm({ ...form, consultation_fee: e.target.value })}
          />
        </div>
      </section>

      {/* Prescriptions */}
      <section className="card mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Prescription</h2>
          {!readOnly && (
            <button
              className="btn-secondary text-sm"
              onClick={() => setRows((rs) => [...rs, blankRow()])}
            >
              + Add medicine
            </button>
          )}
        </div>
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div
              key={i}
              className="grid grid-cols-2 gap-2 rounded-md border border-gray-200 p-3 md:grid-cols-12"
            >
              <div className="col-span-2 md:col-span-3">
                <label className="label">Medicine</label>
                <MedicineSelect
                  medicines={medicines}
                  value={r.medicine_id}
                  disabled={readOnly}
                  onChange={(id) => updateRow(i, { medicine_id: id })}
                />
              </div>
              <div className="md:col-span-1">
                <label className="label">Dose</label>
                <input className="input" disabled={readOnly} value={r.dose} onChange={(e) => updateRow(i, { dose: e.target.value })} placeholder="1 tab" />
              </div>
              <div className="md:col-span-1">
                <label className="label">Freq</label>
                <select className="input" disabled={readOnly} value={r.freq} onChange={(e) => updateRow(i, { freq: e.target.value as Frequency })}>
                  {FREQS.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="label">Days</label>
                <input type="number" className="input" disabled={readOnly} value={r.duration_days} onChange={(e) => updateRow(i, { duration_days: e.target.value })} />
              </div>
              <div className="md:col-span-1">
                <label className="label">Route</label>
                <input className="input" disabled={readOnly} value={r.route} onChange={(e) => updateRow(i, { route: e.target.value })} />
              </div>
              <div className="md:col-span-1">
                <label className="label">Food</label>
                <select className="input" disabled={readOnly} value={r.before_after_food} onChange={(e) => updateRow(i, { before_after_food: e.target.value })}>
                  <option value="">—</option>
                  <option value="before">Before</option>
                  <option value="after">After</option>
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="label">Qty</label>
                <input
                  type="number"
                  className="input"
                  disabled={readOnly}
                  value={r.qty_calculated}
                  onChange={(e) => updateRow(i, { qty_calculated: e.target.value, qtyTouched: true })}
                />
              </div>
              <div className="col-span-2 md:col-span-2">
                <label className="label">Instructions</label>
                <input className="input" disabled={readOnly} value={r.instructions} onChange={(e) => updateRow(i, { instructions: e.target.value })} />
              </div>
              {!readOnly && (
                <div className="col-span-2 flex items-end md:col-span-1">
                  <button
                    className="text-sm text-red-600 hover:underline"
                    onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {msg && <p className="mt-4 text-sm text-gray-600">{msg}</p>}

      {!readOnly && (
        <div className="mt-6 flex gap-3 no-print">
          <button className="btn-secondary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button className="btn-primary" onClick={discharge} disabled={saving}>
            Save & discharge
          </button>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Area({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <textarea
        className="input min-h-[70px]"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
