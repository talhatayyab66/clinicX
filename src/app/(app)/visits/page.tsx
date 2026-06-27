import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";

interface Row {
  id: string;
  visit_date: string;
  complaint: string | null;
  diagnosis: string | null;
  status: string;
  patients: { name: string; patient_no: number } | null;
}

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const supabase = createClient();
  const settings = await getSettings();
  const status = searchParams.status ?? "open";

  let query = supabase
    .from("visits")
    .select("id, visit_date, complaint, diagnosis, status, patients(name, patient_no)")
    .order("visit_date", { ascending: false })
    .limit(100);
  if (status !== "all") query = query.eq("status", status);

  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  const tabs = ["open", "discharged", "dispensed", "all"];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Visits</h1>

      <div className="mb-4 flex gap-2">
        {tabs.map((t) => (
          <Link
            key={t}
            href={`/visits?status=${t}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
              status === t
                ? "bg-brand-600 text-white"
                : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Patient</th>
              <th>Complaint</th>
              <th>Diagnosis</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-gray-400">
                  No visits.
                </td>
              </tr>
            ) : (
              rows.map((v) => (
                <tr key={v.id}>
                  <td>{fmtDateTime(v.visit_date, settings)}</td>
                  <td className="font-medium">
                    {v.patients?.name ?? "—"}{" "}
                    <span className="text-gray-400">#{v.patients?.patient_no}</span>
                  </td>
                  <td>{v.complaint ?? "—"}</td>
                  <td>{v.diagnosis ?? "—"}</td>
                  <td className="capitalize">{v.status}</td>
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
