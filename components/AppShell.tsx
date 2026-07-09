import Link from "next/link";
import { AuthStatus } from "@/components/AuthStatus";
import { Logo } from "@/components/Logo";

const nav = [
  ["/hoy", "Inicio / Dashboard"],
  ["/clientes", "Clientes"],
  ["/expedientes", "Expedientes"],
  ["/propuestas", "Presupuestos"],
  ["/compras", "Compras / Proveedores"],
  ["/viajeros", "Viajeros y Documentos"],
  ["/contratos", "Contrato, Firma y Pago"],
  ["/informes", "Informes"],
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
        <div className="sidebar-footer">
          <span>Ayuda</span>
          <small>Operar mejor. Viajar más lejos.</small>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div className="searchbox">Buscar expedientes, clientes, reservas...</div>
          <div className="topbar-actions">
            <span className="topbar-icon">⌁</span>
            <span className="topbar-icon">◇</span>
            <AuthStatus />
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
