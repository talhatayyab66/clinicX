import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DOMAIN = process.env.CLINIC_DOMAIN || "clinic.local";

// GET → is setup still available? (no profiles yet)
export async function GET() {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ available: (count ?? 0) === 0 });
}

// POST → create the very first admin + the settings row. Self-disables.
export async function POST(req: Request) {
  const admin = createAdminClient();

  // Guard: only allowed while there are zero profiles.
  const { count } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true });
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Setup already completed." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const username = (body?.username ?? "").trim().toLowerCase();
  const password = body?.password ?? "";
  const full_name = (body?.full_name ?? "").trim();
  const clinic_name = (body?.clinic_name ?? "").trim() || "My Clinic";

  if (!username || !password || !full_name) {
    return NextResponse.json(
      { error: "username, password and full_name are required" },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const email = `${username}@${DOMAIN}`;

  // 1. create the auth user
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, full_name },
  });
  if (authErr || !created?.user) {
    return NextResponse.json(
      { error: authErr?.message ?? "Failed to create auth user" },
      { status: 500 }
    );
  }

  // 2. profile row, role = admin
  const { error: profErr } = await admin.from("profiles").insert({
    id: created.user.id,
    username,
    full_name,
    role: "admin",
  });
  if (profErr) {
    // roll back the orphan auth user
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  // 3. settings singleton
  await admin
    .from("settings")
    .upsert({ id: 1, clinic_name }, { onConflict: "id" });

  return NextResponse.json({ ok: true });
}
