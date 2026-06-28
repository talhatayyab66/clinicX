"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Autocomplete from "@/components/Autocomplete";
import { COMPLAINTS } from "@/lib/clinicalData";
import { fetchTerms, mergeOptions, rememberTerm } from "@/lib/terms";
import type { Patient, Vitals } from "@/lib/types";

export default function IntakePage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [selected, setSelected] = useState<Patient | null>(null);

  const [newPatient, setNewPatient] = useState({
    name: "",
    age: "",
    gender: "",
    phone: "",
    weight: "",
    allergies: "",
  });

  const [vitals, setVitals] = useState({ bp: "", pulse: "", temp: "", spo2: "" });
  const [complaint, setComplaint] = useState("");
  const [complaintOpts, setComplaintOpts] = useState<string[]>(COMPLAINTS);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async () => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    let query;
    if (/^\d+$/.test(term)) {
      query = supabase.from("patients").select("*").eq("patient_no", Number(term));
    } else {
      query = supabase
        .from("patients")
        .select("*")
        .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
        .limit(20);
    }
    const { data } = await query;
    setResults((data ?? []) as Patient[]);
  }, [q, supabase]);

  useEffect(() => {
    const t = setTimeout(search, 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetchTerms(supabase, "complaint").then((c) =>
      setComplaintOpts(mergeOptions(COMPLAINTS, c))
    );
  }, [supabase]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    try {
      let patientId = selected?.id;

      if (mode === "new") {
        if (!newPatient.name.trim()) throw new Error("Patient name is required");
        const { data, error } = await supabase
          .from("patients")
          .insert({
            name: newPatient.name.trim(),
            age: newPatient.age ? Number(newPatient.age) : null,
            gender: newPatient.gender || null,
            phone: newPatient.phone || null,
            weight: newPatient.weight ? Number(newPatient.weight) : null,
            allergies: newPatient.allergies || null,
            created_by: user?.id ?? null,
          })
          .select("id")
          .single();
        if (error) throw error;
        patientId = data.id;
      }

      if (!patientId) throw new Error("Please select or add a patient");

      const v: Vitals = {
        bp: vitals.bp || undefined,
        pulse: vitals.pulse || undefined,
        temp: vitals.temp || undefined,
        spo2: vitals.spo2 || undefined,
      };

      const { error: vErr } = await supabase.from("visits").insert({
        patient_id: patientId,
        vitals: v,
        complaint: complaint || null,
        status: "open",
      });
      if (vErr) throw vErr;

      await rememberTerm(supabase, "complaint", complaint, complaintOpts);
      router.push("/intake/done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">New visit — intake</h1>
      <p className="mb-6 text-sm text-gray-500">
        Record the patient, vitals and complaint. The doctor completes the rest.
      </p>

      <form onSubmit={save} className="space-y-6">
        {/* patient */}
        <section className="card">
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                mode === "existing"
                  ? "bg-brand-600 text-white"
                  : "border border-gray-300 bg-white text-gray-600"
              }`}
            >
              Existing patient
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                mode === "new"
                  ? "bg-brand-600 text-white"
                  : "border border-gray-300 bg-white text-gray-600"
              }`}
            >
              New patient
            </button>
          </div>

          {mode === "existing" ? (
            <div>
              {selected ? (
                <div className="flex items-center justify-between rounded-md border border-brand-200 bg-brand-50 px-4 py-3">
                  <div>
                    <div className="font-medium">{selected.name}</div>
                    <div className="text-xs text-gray-500">
                      #{selected.patient_no} · {selected.gender ?? "—"} ·{" "}
                      {selected.age ? `${selected.age}y` : "—"}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-sm text-brand-700 hover:underline"
                    onClick={() => setSelected(null)}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <input
                    className="input"
                    placeholder="Search name, phone or patient #"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                  {results.length > 0 && (
                    <ul className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-200">
                      {results.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-gray-50"
                            onClick={() => {
                              setSelected(p);
                              setResults([]);
                              setQ("");
                            }}
                          >
                            <span className="font-medium">{p.name}</span>
                            <span className="text-xs text-gray-400">
                              #{p.patient_no} · {p.phone ?? "—"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Name *</label>
                <input className="input" required value={newPatient.name} onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Age</label>
                <input type="number" className="input" value={newPatient.age} onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })} />
              </div>
              <div>
                <label className="label">Gender</label>
                <select className="input" value={newPatient.gender} onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}>
                  <option value="">—</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={newPatient.phone} onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })} />
              </div>
              <div>
                <label className="label">Weight (kg)</label>
                <input type="number" step="0.1" className="input" value={newPatient.weight} onChange={(e) => setNewPatient({ ...newPatient, weight: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="label">Allergies</label>
                <input className="input" value={newPatient.allergies} onChange={(e) => setNewPatient({ ...newPatient, allergies: e.target.value })} />
              </div>
            </div>
          )}
        </section>

        {/* vitals */}
        <section className="card">
          <h2 className="mb-3 font-semibold">Vitals</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <label className="label">BP</label>
              <input className="input" placeholder="120/80" value={vitals.bp} onChange={(e) => setVitals({ ...vitals, bp: e.target.value })} />
            </div>
            <div>
              <label className="label">Pulse</label>
              <input className="input" placeholder="bpm" value={vitals.pulse} onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })} />
            </div>
            <div>
              <label className="label">Temp</label>
              <input className="input" placeholder="°C" value={vitals.temp} onChange={(e) => setVitals({ ...vitals, temp: e.target.value })} />
            </div>
            <div>
              <label className="label">SpO₂</label>
              <input className="input" placeholder="%" value={vitals.spo2} onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })} />
            </div>
          </div>
        </section>

        {/* complaint */}
        <section className="card">
          <label className="label">Presenting complaint</label>
          <Autocomplete
            value={complaint}
            options={complaintOpts}
            placeholder="Type to search complaints…"
            onChange={setComplaint}
          />
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button className="btn-primary w-full md:w-auto" disabled={saving}>
          {saving ? "Saving…" : "Save & send to doctor"}
        </button>
      </form>
    </div>
  );
}
