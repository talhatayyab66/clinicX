import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/auth";
import type { Medicine, Patient, Prescription, Visit } from "@/lib/types";
import VisitEditor from "./VisitEditor";

export default async function VisitPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const settings = await getSettings();

  const { data: visit } = await supabase
    .from("visits")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!visit) notFound();
  const v = visit as Visit;

  const [{ data: patient }, { data: meds }, { data: rx }] = await Promise.all([
    supabase.from("patients").select("*").eq("id", v.patient_id).single(),
    supabase.from("medicines").select("*").eq("is_active", true).order("name"),
    supabase.from("prescriptions").select("*").eq("visit_id", v.id),
  ]);

  return (
    <div>
      <Link
        href={`/patients/${v.patient_id}`}
        className="text-sm text-brand-600 hover:underline"
      >
        ← Patient
      </Link>
      <VisitEditor
        visit={v}
        patient={patient as Patient}
        medicines={(meds ?? []) as Medicine[]}
        initialRx={(rx ?? []) as Prescription[]}
        settings={settings}
      />
    </div>
  );
}
