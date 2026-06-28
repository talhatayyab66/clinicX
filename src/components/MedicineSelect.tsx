"use client";

import { useEffect, useRef, useState } from "react";
import type { Medicine } from "@/lib/types";

export default function MedicineSelect({
  medicines,
  value,
  onChange,
  disabled,
}: {
  medicines: Medicine[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const selected = medicines.find((m) => m.id === value);
  const label = (m: Medicine) =>
    `${m.name}${m.strength ? ` ${m.strength}` : ""}`;

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const term = query.trim().toLowerCase();
  const matches = (
    term
      ? medicines.filter(
          (m) =>
            m.name.toLowerCase().includes(term) ||
            (m.generic_name ?? "").toLowerCase().includes(term)
        )
      : medicines
  ).slice(0, 12);

  return (
    <div className="relative" ref={ref}>
      <input
        className="input"
        disabled={disabled}
        placeholder="Search medicine…"
        value={open ? query : selected ? label(selected) : ""}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
      />
      {open && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-400">No medicines found.</li>
          ) : (
            matches.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(m.id);
                    setOpen(false);
                  }}
                >
                  <span>
                    {m.name}
                    {m.strength ? <span className="text-gray-400"> {m.strength}</span> : null}
                  </span>
                  <span
                    className={`shrink-0 text-xs ${
                      m.stock_qty <= (m.reorder_level ?? 10)
                        ? "text-amber-600"
                        : "text-gray-400"
                    }`}
                  >
                    stock {m.stock_qty}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
