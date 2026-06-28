"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [form, setForm] = useState({
    clinic_name: "",
    full_name: "",
    username: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((d) => setAvailable(!!d.available))
      .catch(() => setAvailable(false));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Setup failed");
      return;
    }
    router.push("/login");
  }

  if (available === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Checking…
      </div>
    );
  }

  if (!available) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="card max-w-md text-center">
          <h1 className="text-xl font-semibold">Setup already completed</h1>
          <p className="mt-2 text-sm text-gray-500">
            An admin account already exists. Please sign in instead.
          </p>
          <a href="/login" className="btn-primary mt-4 inline-flex">
            Go to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-gray-100 p-4">
      <div className="w-full max-w-md">
        <h1 className="mb-1 text-2xl font-bold text-brand-700">Welcome to ClinicX</h1>
        <p className="mb-6 text-sm text-gray-500">
          Create an administrator account.
        </p>
        <form onSubmit={onSubmit} className="card space-y-4">
          <div>
            <label className="label">Clinic name</label>
            <input
              className="input"
              value={form.clinic_name}
              onChange={(e) => setForm({ ...form, clinic_name: e.target.value })}
              placeholder="My Clinic"
            />
          </div>
          <div>
            <label className="label">Your full name</label>
            <input
              className="input"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Username</label>
            <input
              className="input"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
              required
            />
            <p className="mt-1 text-xs text-gray-400">
              Used for sign-in and password recovery.
            </p>
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Creating…" : "Create admin account"}
          </button>
        </form>
      </div>
    </div>
  );
}
