import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import type { Patient, Visit } from "@/lib/types";
import StartVisitButton from "./StartVisitButton";

export default async function PatientHistory({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const settings = await getSettings();

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!patient) notFound();
  const p = patient as Patient;

  const { data: visitsData } = await supabase
    .from("visits")
    .select("*")
    .eq("patient_id", p.id)
    .order("visit_date", { ascending: false });
  const visits = (visitsData ?? []) as Visit[];

  return (
    <div>
      <Link href="/patients" className="text-sm text-brand-600 hover:underline">
        ← Patients
      </Link>

      <div className="mt-3 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold">{p.name}</h1>
          <p className="text-sm text-gray-500">
            #{p.patient_no} · {p.gender ?? "—"} · {p.age ? `${p.age}y` : "—"} ·{" "}
            {p.phone ?? "no phone"}
          </p>
        </div>
        <StartVisitButton patientId={p.id} />
      </div>

      {p.allergies && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <strong>Allergies:</strong> {p.allergies}
        </div>
      )}

      <h2 className="mb-3 mt-8 font-semibold">Visit history</h2>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Complaint</th>
              <th>Diagnosis</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visits.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-gray-400">
                  No visits yet.
                </td>
              </tr>
            ) : (
              visits.map((v) => (
                <tr key={v.id}>
                  <td>{fmtDateTime(v.visit_date, settings)}</td>
                  <td>{v.complaint ?? "—"}</td>
                  <td>{v.diagnosis ?? "—"}</td>
                  <td>
                    <StatusBadge status={v.status} />
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/visits/${v.id}`}
                      className="text-brand-600 hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: "bg-blue-100 text-blue-700",
    discharged: "bg-amber-100 text-amber-700",
    dispensed: "bg-green-100 text-green-700",
    cancelled: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`badge ${colors[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}
