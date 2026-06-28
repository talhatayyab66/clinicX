import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
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

// Standard co-morbidity checklist (as on the printed pad)
const CO_MORBS = ["HTN", "DM", "TB", "Hep B", "Hep C", "Asthma", "IHD", "CKD"];

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
  const comorbText = (v.comorbidities ?? "").toLowerCase();
  const doctorName =
    doctor && "full_name" in (doctor as object)
      ? (doctor as { full_name: string }).full_name
      : null;

  const vitalsLine = [
    vit.bp && `BP ${vit.bp}`,
    vit.pulse && `Pulse ${vit.pulse}`,
    vit.temp && `Temp ${vit.temp}`,
    vit.spo2 && `SpO₂ ${vit.spo2}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <div className="mb-4 flex gap-2 no-print">
        <PrintButton label="Print prescription" />
      </div>

      <div className="print-area mx-auto flex min-h-[1100px] max-w-[210mm] flex-col bg-white text-gray-900 shadow-sm print:shadow-none">
        {/* ---------- header ---------- */}
        <div className="px-10 pt-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {settings?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.logo_url}
                  alt="logo"
                  className="h-20 w-20 object-contain"
                />
              ) : (
                <div className="h-20 w-20 rounded-full border border-gray-300" />
              )}
              <div className="leading-none">
                <div className="text-4xl font-extrabold uppercase tracking-wide text-gray-700">
                  {settings?.clinic_name ?? "Clinic"}
                </div>
              </div>
            </div>
            <div className="text-right text-sm">
              {doctorName && <div className="font-semibold text-gray-800">{doctorName}</div>}
              {settings?.phone && (
                <div className="mt-1 text-xs text-gray-500">{settings.phone}</div>
              )}
            </div>
          </div>

          {/* decorative divider with + */}
          <div className="mt-3 flex items-center">
            <div className="h-[3px] flex-1 rounded bg-gray-700" />
            <span className="px-2 text-xl font-bold text-gray-700">+</span>
          </div>

          {/* patient row */}
          <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-2 text-sm">
            <Field label="Name" value={p?.name} grow />
            <Field label="Age" value={p?.age ? String(p.age) : ""} />
            <Field label="Gender" value={p?.gender ?? ""} />
            <Field label="Date" value={fmtDate(v.visit_date, settings)} />
          </div>
        </div>

        {/* ---------- body: left column + Rx ---------- */}
        <div className="mt-4 flex flex-1">
          {/* left column */}
          <div className="w-[34%] border-r-2 border-gray-400 px-10 pb-6 pt-2 text-sm">
            <Block label="CC" value={v.complaint} />
            <Block label="O.E" value={[vitalsLine, v.notes].filter(Boolean).join(" — ")} />

            <div className="mt-6">
              <div className="font-semibold">Co morbs:</div>
              <ul className="mt-1 space-y-1">
                {CO_MORBS.map((c) => {
                  const checked = comorbText.includes(c.toLowerCase());
                  return (
                    <li key={c} className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-4 w-4 items-center justify-center border ${
                          checked ? "border-gray-700 bg-gray-700 text-white" : "border-gray-500"
                        }`}
                      >
                        {checked ? "✓" : ""}
                      </span>
                      <span>{c}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Allergies — below co-morbs, as requested */}
            <div className="mt-6">
              <div className="font-semibold">Allergies:</div>
              <div className="mt-1 min-h-[1.25rem] border-b border-gray-300 pb-1">
                {p?.allergies || ""}
              </div>
            </div>

            <div className="mt-6">
              <div className="font-semibold">Investigations:</div>
              <div className="mt-1 whitespace-pre-line">{v.diagnosis || ""}</div>
              {!v.diagnosis && (
                <div className="mt-1 space-y-3">
                  <div className="border-b border-gray-300" />
                  <div className="border-b border-gray-300" />
                  <div className="border-b border-gray-300" />
                </div>
              )}
            </div>
          </div>

          {/* Rx area */}
          <div className="flex-1 px-8 pb-6 pt-2">
            <div className="text-3xl font-serif font-bold">℞</div>
            <table className="mt-3 w-full text-sm">
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td className="py-2 text-gray-400">No medicines prescribed.</td>
                  </tr>
                ) : (
                  lines.map((l, i) => (
                    <tr key={i} className="align-top">
                      <td className="w-6 py-2 text-gray-500">{i + 1}.</td>
                      <td className="py-2">
                        <div className="font-semibold">
                          {l.medicines?.name}
                          {l.medicines?.strength ? ` ${l.medicines.strength}` : ""}
                          {l.medicines?.form ? ` (${l.medicines.form})` : ""}
                        </div>
                        <div className="text-gray-600">
                          {[
                            l.dose,
                            l.freq,
                            l.duration_days ? `× ${l.duration_days} day(s)` : null,
                            l.before_after_food ? `${l.before_after_food} food` : null,
                            l.route,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                          {l.qty_calculated ? `  —  Qty: ${l.qty_calculated}` : ""}
                        </div>
                        {l.instructions && (
                          <div className="text-xs italic text-gray-500">{l.instructions}</div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---------- footer ---------- */}
        <div className="mt-auto">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 px-10 py-3 text-xs text-gray-600">
            {settings?.phone && <span>📞 {settings.phone}</span>}
            {settings?.email && <span>✉ {settings.email}</span>}
          </div>
          <div className="rounded-t-[40px] bg-gray-800 px-10 py-4 text-center text-xs text-white">
            {settings?.address ?? ""}
            {settings?.receipt_footer ? ` · ${settings.receipt_footer}` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  grow,
}: {
  label: string;
  value?: string;
  grow?: boolean;
}) {
  return (
    <div className={`flex items-end gap-2 ${grow ? "min-w-[40%] flex-1" : ""}`}>
      <span className="font-semibold">{label}:</span>
      <span className="flex-1 border-b border-gray-400 pb-0.5">{value || ""}</span>
    </div>
  );
}

function Block({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="mt-3">
      <span className="font-semibold">{label}:</span>{" "}
      <span className="whitespace-pre-line">{value || ""}</span>
    </div>
  );
}
