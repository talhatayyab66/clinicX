"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/lib/types";

export default function UsersClient({
  initial,
  selfId,
}: {
  initial: Profile[];
  selfId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [users] = useState<Profile[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    username: "",
    password: "",
    role: "doctor" as UserRole,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to create user");
      return;
    }
    setShowForm(false);
    setForm({ full_name: "", username: "", password: "", role: "doctor" });
    router.refresh();
  }

  async function toggleActive(u: Profile) {
    await supabase
      .from("profiles")
      .update({ is_active: !u.is_active })
      .eq("id", u.id);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "Create user"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="card mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <label className="label">Full name</label>
            <input className="input" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Username</label>
            <input className="input" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" className="input" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
              <option value="doctor">Doctor</option>
              <option value="dispenser">Dispenser</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600 md:col-span-4">{error}</p>}
          <div className="md:col-span-4">
            <button className="btn-primary" disabled={busy}>
              {busy ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">{u.full_name}</td>
                <td>{u.username}</td>
                <td className="capitalize">{u.role}</td>
                <td>
                  <span
                    className={`badge ${
                      u.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {u.is_active ? "active" : "inactive"}
                  </span>
                </td>
                <td className="text-right">
                  {u.id !== selfId && (
                    <button
                      className="text-brand-600 hover:underline"
                      onClick={() => toggleActive(u)}
                    >
                      {u.is_active ? "Deactivate" : "Activate"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
