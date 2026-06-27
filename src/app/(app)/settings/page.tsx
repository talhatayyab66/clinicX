import { redirect } from "next/navigation";
import { getProfile, getSettings } from "@/lib/auth";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");
  const settings = await getSettings();
  return <SettingsClient settings={settings} />;
}
