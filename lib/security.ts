export type AppRole = "admin" | "direction" | "sales" | "operations" | "billing" | "viewer";

export type TeamMember = {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  status: "active" | "invited" | "disabled";
  last_seen: string;
};

export type PermissionArea = {
  area: string;
  admin: boolean;
  direction: boolean;
  sales: boolean;
  operations: boolean;
  billing: boolean;
  viewer: boolean;
};

export type AuditItem = {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entity_label: string;
  created_at: string;
  risk: "low" | "medium" | "high";
};

export const roles: AppRole[] = ["admin", "direction", "sales", "operations", "billing", "viewer"];

export const demoTeam: TeamMember[] = [
  { id: "member-1", full_name: "Admin Routsify", email: "admin@example.com", role: "admin", status: "active", last_seen: "hoy" },
  { id: "member-2", full_name: "Dirección Demo", email: "direccion@example.com", role: "direction", status: "active", last_seen: "ayer" },
  { id: "member-3", full_name: "Ventas Demo", email: "ventas@example.com", role: "sales", status: "invited", last_seen: "pendiente" },
  { id: "member-4", full_name: "Operaciones Demo", email: "ops@example.com", role: "operations", status: "active", last_seen: "hace 2 días" },
  { id: "member-5", full_name: "Facturación Demo", email: "billing@example.com", role: "billing", status: "active", last_seen: "hace 1 semana" },
];

export const permissionMatrix: PermissionArea[] = [
  { area: "Clientes", admin: true, direction: true, sales: true, operations: true, billing: false, viewer: true },
  { area: "Expedientes", admin: true, direction: true, sales: true, operations: true, billing: true, viewer: true },
  { area: "Presupuestos", admin: true, direction: true, sales: true, operations: false, billing: false, viewer: true },
  { area: "Compras proveedor", admin: true, direction: true, sales: false, operations: true, billing: true, viewer: true },
  { area: "Pagos y fiscalidad", admin: true, direction: true, sales: false, operations: false, billing: true, viewer: true },
  { area: "Integraciones", admin: true, direction: true, sales: false, operations: false, billing: false, viewer: true },
  { area: "Usuarios y roles", admin: true, direction: false, sales: false, operations: false, billing: false, viewer: false },
];

export const demoAuditLog: AuditItem[] = [
  { id: "audit-1", actor: "Admin Routsify", action: "created_client", entity: "client", entity_label: "Laura Martín", created_at: "2026-02-01 10:20", risk: "low" },
  { id: "audit-2", actor: "Ventas Demo", action: "created_budget_line", entity: "budget_line", entity_label: "Hotel boutique Kioto", created_at: "2026-02-02 12:00", risk: "medium" },
  { id: "audit-3", actor: "Facturación Demo", action: "changed_payment_status", entity: "payment", entity_label: "TRF-DEMO-001", created_at: "2026-02-10 09:45", risk: "medium" },
  { id: "audit-4", actor: "Operaciones Demo", action: "marked_supplier_invoice_approved", entity: "supplier_invoice", entity_label: "Lodge Arenal", created_at: "2026-02-11 15:10", risk: "high" },
];

export function securitySummary(team: TeamMember[], audit: AuditItem[]) {
  const active = team.filter((member) => member.status === "active").length;
  const invited = team.filter((member) => member.status === "invited").length;
  const highRisk = audit.filter((item) => item.risk === "high").length;
  return { total: team.length, active, invited, highRisk };
}
