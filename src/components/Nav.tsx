"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Profile, UserRole } from "@/lib/types";
import SignOutButton from "./SignOutButton";

interface NavItem {
  href: string;
  label: string;
  roles: UserRole[];
}

const ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", roles: ["admin", "doctor"] },
  { href: "/intake", label: "New visit", roles: ["admin", "doctor", "dispenser"] },
  { href: "/patients", label: "Patients", roles: ["admin", "doctor"] },
  { href: "/visits", label: "Visits", roles: ["admin", "doctor"] },
  { href: "/inventory", label: "Inventory", roles: ["admin", "doctor"] },
  { href: "/dispense", label: "Discharge queue", roles: ["admin", "dispenser"] },
  { href: "/expenses", label: "Expenses", roles: ["admin"] },
  { href: "/reports", label: "Reports", roles: ["admin", "doctor"] },
  { href: "/users", label: "Users", roles: ["admin"] },
  { href: "/settings", label: "Settings", roles: ["admin"] },
];

export default function Nav({
  profile,
  clinicName,
}: {
  profile: Profile;
  clinicName: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = ITEMS.filter((i) => i.roles.includes(profile.role));

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* mobile top bar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:hidden no-print">
        <span className="text-lg font-bold text-brand-700">{clinicName}</span>
        <button
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          onClick={() => setOpen((v) => !v)}
        >
          Menu
        </button>
      </div>

      <aside
        className={`${
          open ? "block" : "hidden"
        } w-full border-b border-gray-200 bg-white md:block md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r no-print`}
      >
        <div className="hidden p-5 md:block">
          <div className="text-lg font-bold text-brand-700">{clinicName}</div>
          <div className="mt-0.5 text-xs text-gray-400">ClinicX</div>
        </div>

        <nav className="flex flex-col gap-1 p-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                isActive(item.href)
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-gray-100 p-3">
          <div className="mb-2 px-1 text-sm">
            <div className="font-medium text-gray-800">{profile.full_name}</div>
            <div className="text-xs capitalize text-gray-400">{profile.role}</div>
          </div>
          <SignOutButton />
        </div>
      </aside>
    </>
  );
}
