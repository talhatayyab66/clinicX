import { redirect } from "next/navigation";
import { getProfile, getSettings } from "@/lib/auth";
import ExpensesClient from "./ExpensesClient";

export default async function ExpensesPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/"); // hard gate; RLS is the real one
  const settings = await getSettings();
  return <ExpensesClient settings={settings} />;
}
