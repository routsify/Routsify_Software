import Link from "next/link";
import { AuthStatus } from "@/components/AuthStatus";
import { Logo } from "@/components/Logo";

const nav = [
  ["/hoy", "Hoy"],
  ["/solicitudes", "Solicitudes"],
  ["/clientes", "Clientes"],
  ["/expedientes", "Expedientes"],
  ["/tareas", "Tareas"],
  ["/comunicaciones", "Comunicaciones"],
  ["/documentos", "Documentos"],
  ["/viajeros", "Viajeros"],
  ["/propuestas", "Propuestas"],
  ["/contratos", "Contratos"],
  ["/proveedores", "Proveedores"],
  ["/compras", "Compras"],
  ["/facturacion", "Pagos y facturación"],
  ["/integraciones", "Integraciones"],
  ["/cierre", "Cierre operativo"],
  ["/informes", "Informes"],
  ["/seguridad", "Seguridad"],
  ["/ajustes/tipos-servicio", "Tipos de servicio"],
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link className="brand" href="/hoy">
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
