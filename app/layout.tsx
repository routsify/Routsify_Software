import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import "./globals.css";

export const metadata: Metadata = {
  title: "Routsify Software",
  description: "Sistema operativo interno para agencia de viajes a medida",
};

const nav = [
  ["/", "Dashboard"],
  ["/clientes", "Clientes"],
  ["/expedientes", "Expedientes"],
  ["/ajustes/tipos-servicio", "Tipos de servicio"],
  ["/propuestas/demo-public-token", "Propuesta pública"],
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <Link className="brand" href="/">
              <Logo size={44} />
              <span>routsify</span>
            </Link>
            <nav className="nav">
              {nav.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
            </nav>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
