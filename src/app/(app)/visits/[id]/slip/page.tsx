import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import type { Patient, Visit } from "@/lib/types";
import PrintButton from "@/components/PrintButton";

interface RxLine {
  dose: string | null;
  freq: string;
  route: string | null;
  duration_days: number | null;
  before_after_food: string | null;
  qty_calculated: number | null;
  instructions: string | null;
  medicines: { name: string; strength: string | null; form: string | null } | null;
}

export default async function SlipPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const settings = await getSettings();

  const { data: visit } = await supabase
    .from("visits")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!visit) notFound();
  const v = visit as Visit;

  const [{ data: patient }, { data: rx }, { data: doctor }] = await Promise.all([
    supabase.from("patients").select("*").eq("id", v.patient_id).single(),
    supabase
      .from("prescriptions")
      .select(
        "dose, freq, route, duration_days, before_after_food, qty_calculated, instructions, medicines(name, strength, form)"
      )
      .eq("visit_id", v.id),
    v.doctor_id
      ? supabase.from("profiles").select("full_name").eq("id", v.doctor_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const p = patient as Patient;
  const lines = (rx ?? []) as unknown as RxLine[];
  const vit = v.vitals ?? {};

  return (
    <div>
      <div className="mb-4 flex gap-2 no-print">
        <PrintButton label="Print slip" />
      </div>

      <div className="print-area mx-auto max-w-[210mm] bg-white p-8 text-sm text-gray-900 shadow-sm print:shadow-none">
        {/* header */}
        <div className="flex items-start justify-between border-b-2 border-gray-800 pb-3">
          <div>
            <h1 className="text-2xl font-bold">{settings?.clinic_name ?? "Clinic"}</h1>
            {settings?.address && <p className="text-xs text-gray-600">{settings.address}</p>}
            {settings?.phone && <p className="text-xs text-gray-600">Tel: {settings.phone}</p>}
          </div>
          <div className="text-right text-xs text-gray-600">
            <p>{fmtDateTime(v.visit_date, settings)}</p>
            <p>Visit #{v.id.slice(0, 8)}</p>
          </div>
        </div>

        {/* patient */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Info k="Patient" val={`${p?.name} (#${p?.patient_no})`} />
          <Info k="Age / Gender" val={`${p?.age ?? "—"} / ${p?.gender ?? "—"}`} />
          <Info k="Phone" val={p?.phone ?? "—"} />
          <Info k="Weight" val={p?.weight ? `${p.weight} kg` : "—"} />
          {p?.allergies && <Info k="Allergies" val={p.allergies} />}
        </div>

        {/* vitals */}
        {(vit.bp || vit.pulse || vit.temp || vit.spo2) && (
          <div className="mt-3 flex flex-wrap gap-4 rounded bg-gray-50 px-3 py-2 text-xs">
            {vit.bp && <span><b>BP:</b> {vit.bp}</span>}
            {vit.pulse && <span><b>Pulse:</b> {vit.pulse}</span>}
            {vit.temp && <span><b>Temp:</b> {vit.temp}</span>}
            {vit.spo2 && <span><b>SpO₂:</b> {vit.spo2}</span>}
          </div>
        )}

        {/* clinical */}
        <div className="mt-4 space-y-1">
          {v.complaint && <p><b>Complaint:</b> {v.complaint}</p>}
          {v.diagnosis && <p><b>Diagnosis:</b> {v.diagnosis}</p>}
          {v.comorbidities && <p><b>Comorbidities:</b> {v.comorbidities}</p>}
        </div>

        {/* Rx */}
        <h2 className="mt-5 text-lg font-bold">℞</h2>
        <table className="mt-1 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-gray-400 text-left">
              <th className="py-1">Drug</th>
              <th>Dose</th>
              <th>Freq</th>
              <th>Duration</th>
              <th>Route</th>
              <th>Food</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-2 text-gray-400">
                  No medicines prescribed.
                </td>
              </tr>
            ) : (
              lines.map((l, i) => (
                <tr key={i} className="border-b border-gray-200 align-top">
                  <td className="py-1 font-medium">
                    {l.medicines?.name}
                    {l.medicines?.strength ? ` ${l.medicines.strength}` : ""}
                    {l.instructions ? (
                      <div className="text-[10px] text-gray-500">{l.instructions}</div>
                    ) : null}
                  </td>
                  <td>{l.dose ?? "—"}</td>
                  <td>{l.freq}</td>
                  <td>{l.duration_days ? `${l.duration_days} d` : "—"}</td>
                  <td>{l.route ?? "—"}</td>
                  <td>{l.before_after_food ?? "—"}</td>
                  <td>{l.qty_calculated ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {v.notes && (
          <p className="mt-4 text-xs">
            <b>Notes:</b> {v.notes}
          </p>
        )}

        {/* signature */}
        <div className="mt-12 flex justify-end">
          <div className="text-center">
            <div className="w-48 border-t border-gray-500 pt-1 text-xs">
              {doctor && "full_name" in (doctor as object)
                ? (doctor as { full_name: string }).full_name
                : "Doctor"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ k, val }: { k: string; val: string }) {
  return (
    <p className="text-xs">
      <span className="text-gray-500">{k}:</span> <span className="font-medium">{val}</span>
    </p>
  );
}
