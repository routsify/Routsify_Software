import Link from "next/link";
import { AuthStatus } from "@/components/AuthStatus";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Logo } from "@/components/Logo";

const nav = [
  ["/hoy", "Inicio"],
  ["/clientes", "Clientes"],
  ["/expedientes", "Expedientes"],
  ["/propuestas", "Presupuestos"],
  ["/compras", "Compras / Proveedores"],
  ["/informes", "Informes"],
  ["/ajustes", "Ajustes"],
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link className="brand" href="/hoy">
          <Logo size={34} />
          <span>Routsify</span>
        </Link>
        <nav className="nav">
          {nav.map(([href, label], index) => (
            <Link key={href} href={href}>
              <span className="nav-index">{index + 1}</span>
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <main className="main">
        <div className="topbar">
          <GlobalSearch />
          <div className="topbar-actions"><AuthStatus /></div>
        </div>
        {children}
      </main>
    </div>
  );
}
