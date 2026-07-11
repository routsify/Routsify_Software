import type { Metadata } from "next";
import "./globals.css";
import "./operational.css";
import "./legacy-form-fix.css";

export const metadata: Metadata = {
  title: "Routsify Software",
  description: "Sistema operativo interno para agencia de viajes a medida",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
