import { appRoles, type AppRole } from "@/lib/settings-master";

export type AppPermission =
  | "app.view"
  | "clients.view"
  | "clients.manage"
  | "cases.view"
  | "cases.manage"
  | "budgets.view"
  | "budgets.manage"
  | "suppliers.view"
  | "suppliers.manage"
  | "purchases.view"
  | "purchases.manage"
  | "communications.view"
  | "communications.manage"
  | "communications.templates.manage"
  | "operations.sensitive.view"
  | "operations.sensitive.manage"
  | "tasks.view"
  | "tasks.manage"
  | "documents.manage"
  | "payment_links.manage"
  | "payments.manage"
  | "reports.view"
  | "settings.view"
  | "settings.manage"
  | "settings.secrets.manage"
  | "system.manage";

const allPermissions: AppPermission[] = [
  "app.view", "clients.view", "clients.manage", "cases.view", "cases.manage", "budgets.view", "budgets.manage",
  "suppliers.view", "suppliers.manage", "purchases.view", "purchases.manage", "communications.view", "communications.manage",
  "communications.templates.manage", "operations.sensitive.view", "operations.sensitive.manage", "tasks.view", "tasks.manage",
  "documents.manage", "payment_links.manage", "payments.manage", "reports.view", "settings.view", "settings.manage",
  "settings.secrets.manage", "system.manage",
];

export const rolePermissions = {
  admin: allPermissions,
  direction: [
    "app.view", "clients.view", "clients.manage", "cases.view", "cases.manage", "budgets.view", "budgets.manage",
    "suppliers.view", "suppliers.manage", "purchases.view", "purchases.manage", "communications.view", "communications.manage",
    "communications.templates.manage", "operations.sensitive.view", "operations.sensitive.manage", "tasks.view", "tasks.manage",
    "payment_links.manage", "payments.manage", "reports.view", "settings.view", "settings.manage", "system.manage",
  ],
  sales: [
    "app.view", "clients.view", "clients.manage", "cases.view", "cases.manage", "budgets.view", "budgets.manage",
    "suppliers.view", "suppliers.manage", "purchases.view", "purchases.manage", "communications.view", "communications.manage",
    "operations.sensitive.view", "operations.sensitive.manage", "tasks.view", "tasks.manage", "documents.manage",
    "payment_links.manage", "reports.view",
  ],
  operations: [
    "app.view", "clients.view", "clients.manage", "cases.view", "cases.manage", "budgets.view", "suppliers.view",
    "suppliers.manage", "purchases.view", "purchases.manage", "communications.view", "communications.manage",
    "operations.sensitive.view", "operations.sensitive.manage", "tasks.view", "tasks.manage", "reports.view",
  ],
  billing: [
    "app.view", "clients.view", "cases.view", "budgets.view", "suppliers.view", "suppliers.manage", "purchases.view",
    "purchases.manage", "communications.view", "communications.manage", "operations.sensitive.view", "operations.sensitive.manage",
    "tasks.view", "tasks.manage", "payments.manage", "reports.view",
  ],
  viewer: ["app.view", "clients.view", "cases.view", "budgets.view", "suppliers.view", "tasks.view"],
} satisfies Record<AppRole, readonly AppPermission[]>;

export function isAppRole(value: unknown): value is AppRole {
  return appRoles.includes(String(value) as AppRole);
}

export function hasPermission(role: string | null | undefined, permission: AppPermission) {
  if (!isAppRole(role)) return false;
  return (rolePermissions[role] as readonly AppPermission[]).includes(permission);
}

export const appNavigation = [
  { href: "/hoy", label: "Hoy", permission: "app.view", section: "Operación" },
  { href: "/solicitudes", label: "Solicitudes", permission: "clients.view", section: "Operación" },
  { href: "/expedientes", label: "Expedientes", permission: "cases.view", section: "Operación" },
  { href: "/propuestas", label: "Presupuestos", permission: "budgets.view", section: "Operación" },
  { href: "/compras", label: "Compras", permission: "purchases.view", section: "Operación" },
  { href: "/clientes", label: "Clientes", permission: "clients.view", section: "Relaciones" },
  { href: "/proveedores", label: "Proveedores", permission: "suppliers.view", section: "Relaciones" },
  { href: "/comunicaciones", label: "Comunicaciones", permission: "communications.view", section: "Relaciones" },
  { href: "/control", label: "Control", permission: "app.view", section: "Gestión" },
  { href: "/informes", label: "Informes", permission: "reports.view", section: "Gestión" },
  { href: "/automatizaciones", label: "Automatizaciones", permission: "settings.manage", section: "Gestión" },
  { href: "/ajustes", label: "Ajustes", permission: "settings.view", section: "Gestión" },
] as const satisfies ReadonlyArray<{ href: string; label: string; permission: AppPermission; section: "Operación" | "Relaciones" | "Gestión" }>;
