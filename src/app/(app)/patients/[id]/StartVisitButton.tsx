"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function StartVisitButton({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("visits")
      .insert({ patient_id: patientId, doctor_id: user?.id ?? null, status: "open" })
      .select("id")
      .single();
    setLoading(false);
    if (error || !data) {
      alert(error?.message ?? "Could not start visit");
      return;
    }
    router.push(`/visits/${data.id}`);
  }

  return (
    <button className="btn-primary" onClick={start} disabled={loading}>
      {loading ? "Starting…" : "Start new visit"}
    </button>
  );
}
