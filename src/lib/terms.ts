import type { SupabaseClient } from "@supabase/supabase-js";

export type TermKind = "complaint" | "diagnosis";

/** Merge built-in + remembered options, de-duped case-insensitively. */
export function mergeOptions(builtIn: string[], extra: string[]): string[] {
  const seen = new Set(builtIn.map((o) => o.toLowerCase()));
  const merged = [...builtIn];
  for (const e of extra) {
    if (!seen.has(e.toLowerCase())) {
      seen.add(e.toLowerCase());
      merged.push(e);
    }
  }
  return merged;
}

/** Fetch remembered terms of a kind. Returns [] if the table isn't there yet. */
export async function fetchTerms(
  supabase: SupabaseClient,
  kind: TermKind
): Promise<string[]> {
  const { data, error } = await supabase
    .from("clinical_terms")
    .select("label")
    .eq("kind", kind)
    .order("label");
  if (error) return [];
  return (data ?? []).map((r: { label: string }) => r.label);
}

/** Save a typed term for next time (skips ones already in `known`). */
export async function rememberTerm(
  supabase: SupabaseClient,
  kind: TermKind,
  label: string,
  known: string[]
): Promise<void> {
  const v = label.trim();
  if (!v) return;
  if (known.some((o) => o.toLowerCase() === v.toLowerCase())) return;
  // ignore unique-violation / missing-table errors
  await supabase.from("clinical_terms").insert({ kind, label: v });
}
