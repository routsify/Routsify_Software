"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarCheck2,
  FileText,
  Inbox,
  MessageCircle,
  Settings2,
  ShoppingCart,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type NavigationItem = {
  href: string;
  label: string;
  section: "Operación" | "Relaciones" | "Gestión";
};

const icons: Record<string, LucideIcon> = {
  "/hoy": CalendarCheck2,
  "/solicitudes": Inbox,
  "/clientes": Users,
  "/expedientes": BriefcaseBusiness,
  "/propuestas": FileText,
  "/proveedores": Building2,
  "/compras": ShoppingCart,
  "/comunicaciones": MessageCircle,
  "/control": Activity,
  "/automatizaciones": Workflow,
  "/informes": BarChart3,
  "/ajustes": Settings2,
};

const sections: NavigationItem["section"][] = ["Operación", "Relaciones", "Gestión"];

export function AppNavigation({ items }: { items: readonly NavigationItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Navegación principal">
      {sections.map((section) => {
        const sectionItems = items.filter((item) => item.section === section);
        if (!sectionItems.length) return null;
        return <div className="nav-group" key={section}>
          <span className="nav-section">{section}</span>
          {sectionItems.map((item) => {
            const Icon = icons[item.href] || Activity;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return <Link className={active ? "active" : undefined} aria-current={active ? "page" : undefined} key={item.href} href={item.href} prefetch={false}>
              <Icon aria-hidden="true" size={18} strokeWidth={2} />
              <span>{item.label}</span>
            </Link>;
          })}
        </div>;
      })}
    </nav>
  );
}
