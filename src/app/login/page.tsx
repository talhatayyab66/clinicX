"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const domain = process.env.NEXT_PUBLIC_CLINIC_DOMAIN || "clinic.local";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const entry = username.trim().toLowerCase();
    // Accept a real email (admins) or a plain username (synthetic email).
    const email = entry.includes("@") ? entry : `${entry}@${domain}`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Invalid username or password.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-gray-100 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-brand-700">ClinicX</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to continue</p>
        </div>
        <form onSubmit={onSubmit} className="card space-y-4">
          <div>
            <label className="label" htmlFor="username">
              Username or email
            </label>
            <input
              id="username"
              className="input"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-gray-400">
          First time? Set up the admin account at{" "}
          <a href="/setup" className="text-brand-600 underline">
            /setup
          </a>
        </p>
      </div>
    </div>
  );
}
