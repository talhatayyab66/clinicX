import { redirect } from "next/navigation";
import { getProfile, getSettings } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  if (!profile) {
    redirect("/login");
  }

  // deactivated accounts are signed out immediately
  if (!profile.is_active) {
    const supabase = createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const settings = await getSettings();
  const clinicName = settings?.clinic_name || "ClinicX";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Nav profile={profile} clinicName={clinicName} />
      <main className="flex-1 overflow-x-hidden p-4 md:p-8">{children}</main>
    </div>
  );
}
