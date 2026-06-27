import { getProfile, getSettings } from "@/lib/auth";
import { redirect } from "next/navigation";
import InventoryClient from "./InventoryClient";

export default async function InventoryPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const settings = await getSettings();
  return (
    <InventoryClient isAdmin={profile.role === "admin"} settings={settings} />
  );
}
