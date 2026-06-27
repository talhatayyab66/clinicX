import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/auth";
import { money, fmtDateTime } from "@/lib/format";
import type { Receipt, Settings } from "@/lib/types";
import PrintButton from "@/components/PrintButton";

interface Line {
  qty: number;
  unit_price: number;
  line_total: number;
  medicines: { name: string; strength: string | null } | null;
}

export default async function ReceiptPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const settings = (await getSettings()) as Settings | null;

  const { data: receipt } = await supabase
    .from("receipts")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!receipt) notFound();
  const r = receipt as Receipt;

  const { data: di } = await supabase
    .from("dispense_items")
    .select("qty, unit_price, line_total, medicines(name, strength)")
    .eq("dispense_id", r.dispense_id);
  const lines = (di ?? []) as unknown as Line[];

  return (
    <div>
      <div className="mb-4 flex gap-2 no-print">
        <Link href="/dispense" className="btn-secondary">← Queue</Link>
        <PrintButton label="Print receipt" />
      </div>

      {/* 80mm thermal-style receipt; on A4 it just centers */}
      <div className="print-area mx-auto w-[80mm] bg-white p-4 font-mono text-[11px] leading-tight text-black shadow-sm print:shadow-none">
        <div className="text-center">
          <div className="text-sm font-bold">{settings?.clinic_name ?? "Clinic"}</div>
          {settings?.address && <div>{settings.address}</div>}
          {settings?.phone && <div>Tel: {settings.phone}</div>}
        </div>

        <Divider />
        <div className="flex justify-between">
          <span>Receipt</span>
          <span>#{r.receipt_no}</span>
        </div>
        <div className="flex justify-between">
          <span>Date</span>
          <span>{fmtDateTime(r.created_at, settings)}</span>
        </div>

        <Divider />
        {lines.map((l, i) => (
          <div key={i} className="mb-1">
            <div>
              {l.medicines?.name} {l.medicines?.strength ?? ""}
            </div>
            <div className="flex justify-between">
              <span>
                {l.qty} × {money(l.unit_price, settings)}
              </span>
              <span>{money(l.line_total, settings)}</span>
            </div>
          </div>
        ))}

        <Divider />
        {r.consultation_fee > 0 && (
          <Row k="Consultation" v={money(r.consultation_fee, settings)} />
        )}
        <Row k="Medicines" v={money(r.medicines_total, settings)} />
        {r.tax > 0 && <Row k="Tax" v={money(r.tax, settings)} />}
        <Divider />
        <Row k="TOTAL" v={money(r.grand_total, settings)} bold />
        <Row k="Received" v={money(r.amount_received, settings)} />
        <Row k="Change" v={money(r.change_due, settings)} />
        <Row k="Method" v={(r.payment_method ?? "—").toUpperCase()} />

        <Divider />
        <div className="text-center">
          {settings?.receipt_footer ?? "Thank you & get well soon"}
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="my-2 border-t border-dashed border-gray-400" />;
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : ""}`}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}
