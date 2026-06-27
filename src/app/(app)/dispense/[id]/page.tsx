import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/auth";
import type { Patient, Settings, Visit } from "@/lib/types";
import DispenseForm from "./DispenseForm";

interface RxLine {
  medicine_id: string | null;
  qty_calculated: number | null;
  freq: string;
  dose: string | null;
  medicines: { name: string; strength: string | null; price: number; stock_qty: number } | null;
}

export default async function DispenseDetail({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const settings = await getSettings();

  const { data: visit } = await supabase
    .from("visits")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!visit) notFound();
  const v = visit as Visit;

  // already dispensed → jump to its receipt
  if (v.status === "dispensed") {
    const { data: r } = await supabase
      .from("receipts")
      .select("id")
      .eq("visit_id", v.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (r?.id) redirect(`/receipts/${r.id}`);
  }

  const [{ data: patient }, { data: rx }] = await Promise.all([
    supabase.from("patients").select("*").eq("id", v.patient_id).single(),
    supabase
      .from("prescriptions")
      .select("medicine_id, qty_calculated, freq, dose, medicines(name, strength, price, stock_qty)")
      .eq("visit_id", v.id),
  ]);

  const lines = (rx ?? []) as unknown as RxLine[];
  const items = lines
    .filter((l) => l.medicine_id)
    .map((l) => ({
      medicine_id: l.medicine_id as string,
      name: l.medicines?.name ?? "",
      strength: l.medicines?.strength ?? "",
      unit_price: Number(l.medicines?.price ?? 0),
      stock_qty: Number(l.medicines?.stock_qty ?? 0),
      qty: Number(l.qty_calculated ?? 0),
    }));

  return (
    <div>
      <Link href="/dispense" className="text-sm text-brand-600 hover:underline">
        ← Queue
      </Link>
      <h1 className="mt-3 text-2xl font-bold">{(patient as Patient)?.name}</h1>
      <p className="mb-6 text-sm text-gray-500">
        #{(patient as Patient)?.patient_no} · {v.diagnosis ?? "no diagnosis"}
      </p>

      <DispenseForm
        visitId={v.id}
        consultationFee={Number(v.consultation_fee ?? 0)}
        items={items}
        settings={settings as Settings}
      />
    </div>
  );
}
