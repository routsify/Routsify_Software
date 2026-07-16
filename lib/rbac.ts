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
  "app.view",
  "clients.view",
  "clients.manage",
  "cases.view",
  "cases.manage",
  "budgets.view",
  "budgets.manage",
  "suppliers.view",
  "suppliers.manage",
  "purchases.view",
  "purchases.manage",
  "communications.view",
  "communications.manage",
  "communications.templates.manage",
  "operations.sensitive.view",
  "operations.sensitive.manage",
  "tasks.view",
  "tasks.manage",
  "documents.manage",
  "payment_links.manage",
  "payments.manage",
  "reports.view",
  "settings.view",
  "settings.manage",
  "settings.secrets.manage",
  "system.manage",
];

export const rolePermissions = {
  admin: allPermissions,
  direction: [
    "app.view",
    "clients.view",
    "clients.manage",
    "cases.view",
    "cases.manage",
    "budgets.view",
    "budgets.manage",
    "suppliers.view",
    "suppliers.manage",
    "purchases.view",
    "purchases.manage",
    "communications.view",
    "communications.manage",
    "communications.templates.manage",
    "operations.sensitive.view",
    "operations.sensitive.manage",
    "tasks.view",
    "tasks.manage",
    "payment_links.manage",
    "payments.manage",
    "reports.view",
    "settings.view",
    "system.manage",
  ],
  sales: [
    "app.view",
    "clients.view",
    "clients.manage",
    "cases.view",
    "cases.manage",
    "budgets.view",
    "budgets.manage",
    "suppliers.view",
    "suppliers.manage",
    "purchases.view",
    "purchases.manage",
    "communications.view",
    "communications.manage",
    "operations.sensitive.view",
    "operations.sensitive.manage",
    "tasks.view",
    "tasks.manage",
    "documents.manage",
    "payment_links.manage",
    "reports.view",
  ],
  operations: [
    "app.view",
    "clients.view",
    "clients.manage",
    "cases.view",
    "cases.manage",
    "budgets.view",
    "suppliers.view",
    "suppliers.manage",
    "purchases.view",
    "purchases.manage",
    "communications.view",
    "communications.manage",
    "operations.sensitive.view",
    "operations.sensitive.manage",
    "tasks.view",
    "tasks.manage",
    "reports.view",
  ],
  billing: [
    "app.view",
    "clients.view",
    "cases.view",
    "budgets.view",
    "suppliers.view",
    "suppliers.manage",
    "purchases.view",
    "purchases.manage",
    "communications.view",
    "communications.manage",
    "operations.sensitive.view",
    "operations.sensitive.manage",
    "tasks.view",
    "tasks.manage",
    "payments.manage",
    "reports.view",
  ],
  viewer: [
    "app.view",
    "clients.view",
    "cases.view",
    "budgets.view",
    "suppliers.view",
    "tasks.view",
  ],
} satisfies Record<AppRole, readonly AppPermission[]>;

export function isAppRole(value: unknown): value is AppRole {
  return appRoles.includes(String(value) as AppRole);
}

export function hasPermission(role: string | null | undefined, permission: AppPermission) {
  if (!isAppRole(role)) return false;
  return (rolePermissions[role] as readonly AppPermission[]).includes(permission);
}

export const appNavigation = [
  { href: "/hoy", label: "Inicio", permission: "app.view" },
  { href: "/control", label: "Control operativo", permission: "app.view" },
  { href: "/clientes", label: "Clientes", permission: "clients.view" },
  { href: "/expedientes", label: "Expedientes", permission: "cases.view" },
  { href: "/propuestas", label: "Presupuestos", permission: "budgets.view" },
  { href: "/compras", label: "Compras / Proveedores", permission: "purchases.view" },
  { href: "/comunicaciones", label: "Comunicaciones", permission: "communications.view" },
  { href: "/informes", label: "Informes", permission: "reports.view" },
  { href: "/ajustes", label: "Ajustes", permission: "settings.view" },
] as const satisfies ReadonlyArray<{ href: string; label: string; permission: AppPermission }>;
