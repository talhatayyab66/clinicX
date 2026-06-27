import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/auth";
import { money, fmtDateTime } from "@/lib/format";

interface QueueRow {
  id: string;
  visit_date: string;
  diagnosis: string | null;
  patients: { name: string; patient_no: number } | null;
}

export default async function DispenseQueue() {
  const supabase = createClient();
  const settings = await getSettings();

  const { data: queue } = await supabase
    .from("visits")
    .select("id, visit_date, diagnosis, patients(name, patient_no)")
    .eq("status", "discharged")
    .order("visit_date", { ascending: true });

  // daily cash summary (receipts created today)
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { data: receipts } = await supabase
    .from("receipts")
    .select("grand_total, amount_received, change_due, payment_method, created_at")
    .gte("created_at", start.toISOString());

  const collected = (receipts ?? []).reduce(
    (s, r: { grand_total: number }) => s + Number(r.grand_total || 0),
    0
  );
  const txns = (receipts ?? []).length;

  const rows = (queue ?? []) as unknown as QueueRow[];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Discharge queue</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        <Stat label="Awaiting dispense" value={String(rows.length)} />
        <Stat label="Collected today" value={money(collected, settings)} />
        <Stat label="Transactions today" value={String(txns)} />
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Discharged</th>
              <th>Patient</th>
              <th>Diagnosis</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-gray-400">
                  Queue is empty.
                </td>
              </tr>
            ) : (
              rows.map((v) => (
                <tr key={v.id}>
                  <td>{fmtDateTime(v.visit_date, settings)}</td>
                  <td className="font-medium">
                    {v.patients?.name}{" "}
                    <span className="text-gray-400">#{v.patients?.patient_no}</span>
                  </td>
                  <td>{v.diagnosis ?? "—"}</td>
                  <td className="text-right">
                    <Link href={`/dispense/${v.id}`} className="btn-primary text-xs">
                      Dispense
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
