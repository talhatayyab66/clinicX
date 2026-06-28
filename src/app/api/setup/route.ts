import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DOMAIN = process.env.CLINIC_DOMAIN || "clinic.local";

// never cache this route — always reflect live DB state
export const dynamic = "force-dynamic";

// GET → setup is always open (multiple admins allowed).
export async function GET() {
  return NextResponse.json({ available: true });
}

// POST → create an admin account (no limit) and ensure the settings row exists.
export async function POST(req: Request) {
  // Surface missing config as a clear message instead of crashing the route.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return NextResponse.json(
      {
        error:
          "Server is missing Supabase configuration. In Vercel, set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the secret key), then redeploy.",
      },
      { status: 500 }
    );
  }

  const admin = createAdminClient();

  const body = await req.json().catch(() => null);
  const username = (body?.username ?? "").trim().toLowerCase();
  const password = body?.password ?? "";
  const full_name = (body?.full_name ?? "").trim();
  const clinic_name = (body?.clinic_name ?? "").trim() || "My Clinic";
  // Optional real email for the admin. Falls back to the synthetic one.
  const emailInput = (body?.email ?? "").trim().toLowerCase();

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
  if (emailInput && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
    return NextResponse.json(
      { error: "Please enter a valid email address" },
      { status: 400 }
    );
  }

  // Use the admin's real email if given, otherwise the synthetic username email.
  const email = emailInput || `${username}@${DOMAIN}`;

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
    const msg = profErr.message.includes("duplicate")
      ? "That username is already taken"
      : profErr.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // 3. settings singleton — only create it the first time; don't overwrite
  // an existing clinic name when later admins are added.
  const { count: settingsCount } = await admin
    .from("settings")
    .select("*", { count: "exact", head: true });
  if ((settingsCount ?? 0) === 0) {
    await admin.from("settings").insert({ id: 1, clinic_name });
  }

  return NextResponse.json({ ok: true });
}
