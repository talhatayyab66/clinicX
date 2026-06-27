import { createClient } from "@/lib/supabase/server";
import type { Profile, Settings, UserRole } from "@/lib/types";

/** Returns the signed-in user's profile, or null. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
}

export async function getSettings(): Promise<Settings | null> {
  const supabase = createClient();
  const { data } = await supabase.from("settings").select("*").eq("id", 1).single();
  return (data as Settings) ?? null;
}

export function roleCanAccess(role: UserRole, section: string): boolean {
  const map: Record<string, UserRole[]> = {
    dashboard: ["admin", "doctor"],
    patients: ["admin", "doctor"],
    visits: ["admin", "doctor"],
    inventory: ["admin", "doctor"],
    expenses: ["admin"],
    reports: ["admin", "doctor"], // doctor gets a reduced view in-page
    users: ["admin"],
    settings: ["admin"],
    dispense: ["admin", "dispenser"],
  };
  return (map[section] ?? []).includes(role);
}
