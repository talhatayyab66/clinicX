import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClinicX",
  description: "Clinic management — patients, visits, dispensing & reports",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export const viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
