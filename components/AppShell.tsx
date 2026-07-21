import Link from "next/link";
import { AppNavigation } from "@/components/AppNavigation";
import { AuthStatus } from "@/components/AuthStatus";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Logo } from "@/components/Logo";
import { PermissionProvider } from "@/components/PermissionProvider";
import { ThemeShell } from "@/components/ThemeShell";
import { requireAppSession } from "@/lib/app-auth";
import { loadAppTheme } from "@/lib/app-theme-server";
import { appNavigation, hasPermission } from "@/lib/rbac";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await requireAppSession();
  const theme = await loadAppTheme(session.organizationId);
  const visibleLabels = new Set(theme.navigation || appNavigation.map((item) => item.label));
  visibleLabels.add("Control operativo");
  visibleLabels.add("Comunicaciones");
  visibleLabels.add("Automatizaciones");
  visibleLabels.add("Solicitudes");
  if (visibleLabels.has("Compras / Proveedores")) {
    visibleLabels.add("Proveedores");
    visibleLabels.add("Compras");
  }

  const visibleNavigation = appNavigation.filter((item) =>
    hasPermission(session.role, item.permission) && visibleLabels.has(item.label),
  );

  return (
    <PermissionProvider role={session.role}>
      <ThemeShell theme={theme}>
        <a className="skip-link" href="#main-content">Saltar al contenido</a>
        <aside className="sidebar">
          <Link className="brand" href="/hoy" prefetch={false}>
            <Logo size={34} />
            <span>{theme.companyName}</span>
          </Link>
          <AppNavigation items={visibleNavigation} />
        </aside>
        <main className="main" id="main-content">
          <div className="topbar">
            <GlobalSearch />
            <div className="topbar-actions"><AuthStatus email={session.email} role={session.role} /></div>
          </div>
          {children}
        </main>
      </ThemeShell>
    </PermissionProvider>
  );
}
