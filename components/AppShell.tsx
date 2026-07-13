import Link from "next/link";
import { AuthStatus } from "@/components/AuthStatus";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Logo } from "@/components/Logo";
import { ThemeShell } from "@/components/ThemeShell";
import { requireAppSession } from "@/lib/app-auth";
import { loadAppTheme } from "@/lib/app-theme-server";

const nav = [
  ["/hoy", "Inicio"],
  ["/control", "Control operativo"],
  ["/clientes", "Clientes"],
  ["/expedientes", "Expedientes"],
  ["/propuestas", "Presupuestos"],
  ["/compras", "Compras / Proveedores"],
  ["/informes", "Informes"],
  ["/ajustes", "Ajustes"],
] as const;

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await requireAppSession();
  const theme = await loadAppTheme(session.organizationId);
  const visibleLabels = new Set(theme.navigation || nav.map((item) => item[1]));
  visibleLabels.add("Control operativo");
  visibleLabels.add("Ajustes");

  return (
    <ThemeShell theme={theme}>
      <aside className="sidebar">
        <Link className="brand" href="/hoy" prefetch={false}>
          <Logo size={34} />
          <span>{theme.companyName}</span>
        </Link>
        <nav className="nav">
          {nav.filter(([, label]) => visibleLabels.has(label)).map(([href, label], index) => (
            <Link key={href} href={href} prefetch={false}>
              <span className="nav-index">{index + 1}</span>
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <main className="main">
        <div className="topbar">
          <GlobalSearch />
          <div className="topbar-actions"><AuthStatus email={session.email} role={session.role} /></div>
        </div>
        {children}
      </main>
    </ThemeShell>
  );
}
