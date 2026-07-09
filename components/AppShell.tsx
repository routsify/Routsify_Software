import Link from "next/link";
import { AuthStatus } from "@/components/AuthStatus";
import { Logo } from "@/components/Logo";
import { buildOperationalInbox } from "@/lib/workbench";

const nav = [
  ["/hoy", "Inicio / Dashboard"],
  ["/clientes", "Clientes"],
  ["/expedientes", "Expedientes"],
  ["/propuestas", "Presupuestos"],
  ["/compras", "Compras / Proveedores"],
  ["/viajeros", "Viajeros y Documentos"],
  ["/contratos", "Contrato, Firma y Pago"],
  ["/informes", "Informes"],
  ["/tareas", "Tareas"],
  ["/integraciones", "Alertas"],
  ["/seguridad", "Configuración"],
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const notifications = buildOperationalInbox().slice(0, 5);
  const critical = notifications.filter((item) => item.urgency === "critical").length;

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
            <Link className="topbar-icon" href="/solicitudes" title="Nueva solicitud">+</Link>
            <details className="notification">
              <summary className="topbar-icon" title="Notificaciones">
                <span>!</span>
                <strong>{notifications.length}</strong>
              </summary>
              <div className="notification-panel">
                <div className="notification-head">
                  <strong>Notificaciones</strong>
                  <span>{critical} críticas</span>
                </div>
                {notifications.map((item) => (
                  <a key={`${item.source}-${item.id}`} href={item.href} className="notification-item">
                    <span className={`dot ${item.urgency}`}></span>
                    <span><strong>{item.title}</strong><small>{item.case_code || item.area} · {item.reason}</small></span>
                  </a>
                ))}
                <a className="notification-all" href="/hoy">Ver todas</a>
              </div>
            </details>
            <Link className="topbar-icon" href="/tareas" title="Calendario">□</Link>
            <div className="user-chip">
              <span className="avatar">MG</span>
              <span><strong>María García</strong><small>Operaciones</small></span>
            </div>
            <AuthStatus />
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
