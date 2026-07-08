import Link from "next/link";
import { AuthStatus } from "@/components/AuthStatus";
import { Logo } from "@/components/Logo";

const nav = [
  ["/", "Dashboard"],
  ["/clientes", "Clientes"],
  ["/expedientes", "Expedientes"],
  ["/compras", "Compras"],
  ["/ajustes/tipos-servicio", "Tipos de servicio"],
  ["/propuestas/demo-public-token", "Propuesta pública"],
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <Logo size={44} />
          <span>routsify</span>
        </Link>
        <nav className="nav">
          {nav.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <div style={{ marginTop: 28 }}>
          <AuthStatus />
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
