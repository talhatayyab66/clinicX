import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

const DOMAIN = process.env.CLINIC_DOMAIN || "clinic.local";
const ALLOWED_ROLES: UserRole[] = ["doctor", "dispenser", "admin"];

export async function POST(req: Request) {
  // 1. verify caller is an authenticated admin (uses the user's own session)
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { data: caller } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!caller || caller.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2. validate input
  const body = await req.json().catch(() => null);
  const username = (body?.username ?? "").trim().toLowerCase();
  const password = body?.password ?? "";
  const full_name = (body?.full_name ?? "").trim();
  const role = body?.role as UserRole;

  if (!username || !password || !full_name || !role) {
    return NextResponse.json(
      { error: "username, password, full_name and role are required" },
      { status: 400 }
    );
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  // 3. create auth user + profile via service role
  const admin = createAdminClient();
  const email = `${username}@${DOMAIN}`;

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, full_name },
  });
  if (authErr || !created?.user) {
    return NextResponse.json(
      { error: authErr?.message ?? "Failed to create user" },
      { status: 500 }
    );
  }

  const { error: profErr } = await admin.from("profiles").insert({
    id: created.user.id,
    username,
    full_name,
    role,
    created_by: user.id,
  });
  if (profErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    const msg = profErr.message.includes("duplicate")
      ? "Username already taken"
      : profErr.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: created.user.id });
}
