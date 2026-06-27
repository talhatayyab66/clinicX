import type { Settings } from "@/lib/types";

export function money(amount: number | null | undefined, settings?: Settings | null): string {
  const n = Number(amount ?? 0);
  const symbol = settings?.currency_symbol ?? "$";
  const region = settings?.region || "US";
  try {
    return `${symbol}${n.toLocaleString(region, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  } catch {
    return `${symbol}${n.toFixed(2)}`;
  }
}

export function fmtDate(value: string | null | undefined, settings?: Settings | null): string {
  if (!value) return "—";
  const region = settings?.region || "US";
  try {
    return new Date(value).toLocaleDateString(region, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return new Date(value).toLocaleDateString();
  }
}

export function fmtDateTime(value: string | null | undefined, settings?: Settings | null): string {
  if (!value) return "—";
  const region = settings?.region || "US";
  try {
    return new Date(value).toLocaleString(region, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return new Date(value).toLocaleString();
  }
}
