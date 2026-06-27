"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Patient } from "@/lib/types";

export default function PatientsPage() {
  const supabase = createClient();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("patients")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    const term = q.trim();
    if (term) {
      if (/^\d+$/.test(term)) {
        query = supabase
          .from("patients")
          .select("*")
          .eq("patient_no", Number(term));
      } else {
        query = supabase
          .from("patients")
          .select("*")
          .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
          .limit(100);
      }
    }
    const { data } = await query;
    setPatients((data ?? []) as Patient[]);
    setLoading(false);
  }, [q, supabase]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Patients</h1>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "Register patient"}
        </button>
      </div>

      {showForm && (
        <PatientForm
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      <input
        className="input mb-4 max-w-md"
        placeholder="Search by name, phone or patient #"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Age</th>
              <th>Gender</th>
              <th>Phone</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : patients.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-gray-400">
                  No patients found.
                </td>
              </tr>
            ) : (
              patients.map((p) => (
                <tr key={p.id}>
                  <td>{p.patient_no}</td>
                  <td className="font-medium">{p.name}</td>
                  <td>{p.age ?? "—"}</td>
                  <td>{p.gender ?? "—"}</td>
                  <td>{p.phone ?? "—"}</td>
                  <td className="text-right">
                    <Link
                      href={`/patients/${p.id}`}
                      className="text-brand-600 hover:underline"
                    >
                      History
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PatientForm({ onSaved }: { onSaved: () => void }) {
  const supabase = createClient();
  const [form, setForm] = useState({
    name: "",
    age: "",
    gender: "",
    phone: "",
    weight: "",
    allergies: "",
    address: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("patients").insert({
      name: form.name.trim(),
      age: form.age ? Number(form.age) : null,
      gender: form.gender || null,
      phone: form.phone || null,
      weight: form.weight ? Number(form.weight) : null,
      allergies: form.allergies || null,
      address: form.address || null,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={save} className="card mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="md:col-span-3">
        <label className="label">Name *</label>
        <input
          className="input"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Age</label>
        <input
          type="number"
          className="input"
          value={form.age}
          onChange={(e) => setForm({ ...form, age: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Gender</label>
        <select
          className="input"
          value={form.gender}
          onChange={(e) => setForm({ ...form, gender: e.target.value })}
        >
          <option value="">—</option>
          <option>Male</option>
          <option>Female</option>
          <option>Other</option>
        </select>
      </div>
      <div>
        <label className="label">Phone</label>
        <input
          className="input"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Weight (kg)</label>
        <input
          type="number"
          step="0.1"
          className="input"
          value={form.weight}
          onChange={(e) => setForm({ ...form, weight: e.target.value })}
        />
      </div>
      <div className="md:col-span-2">
        <label className="label">Allergies</label>
        <input
          className="input"
          value={form.allergies}
          onChange={(e) => setForm({ ...form, allergies: e.target.value })}
        />
      </div>
      <div className="md:col-span-3">
        <label className="label">Address</label>
        <input
          className="input"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
      </div>
      {error && <p className="text-sm text-red-600 md:col-span-3">{error}</p>}
      <div className="md:col-span-3">
        <button className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save patient"}
        </button>
      </div>
    </form>
  );
}
