export type SupplierStatus = "active" | "candidate" | "paused" | "review_required";
export type SupplierRisk = "low" | "medium" | "high";

export type SupplierItem = {
  id: string;
  name: string;
  category: string;
  destination: string;
  contact_name: string;
  email: string;
  phone: string;
  status: SupplierStatus;
  risk: SupplierRisk;
  payment_terms: string;
  cancellation_terms?: string;
  preferred?: boolean;
  last_reviewed_at?: string;
  reviewed_by?: string;
  response_time_hours?: number;
  notes?: string;
};

export const supplierStatuses: SupplierStatus[] = ["active", "candidate", "paused", "review_required"];
export const supplierRisks: SupplierRisk[] = ["low", "medium", "high"];

export const demoSuppliers: SupplierItem[] = [
  {
    id: "supplier-1",
    name: "Hotel Boutique Kioto",
    category: "hotel",
    destination: "Japón",
    contact_name: "Mika Tanaka",
    email: "reservas.kioto@example.com",
    phone: "+81 00 0000 0000",
    status: "active",
    risk: "low",
    payment_terms: "Prepago 30% y resto antes de llegada",
    cancellation_terms: "Cancelación sin coste hasta 30 días antes",
    preferred: true,
    last_reviewed_at: "2026-02-01",
    reviewed_by: "Operaciones Demo",
    response_time_hours: 24,
    notes: "Proveedor preferente demo.",
  },
  {
    id: "supplier-2",
    name: "Transfers Tokyo Premium",
    category: "transfer",
    destination: "Japón",
    contact_name: "Ken Mori",
    email: "ops.tokyo@example.com",
    phone: "+81 00 1111 1111",
    status: "review_required",
    risk: "medium",
    payment_terms: "Factura tras servicio",
    cancellation_terms: "Pendiente de confirmar por escrito",
    preferred: false,
    response_time_hours: 72,
    notes: "Revisar tiempos de respuesta.",
  },
  {
    id: "supplier-3",
    name: "Arenal Lodge Demo",
    category: "hotel",
    destination: "Costa Rica",
    contact_name: "María Solís",
    email: "reservas.arenal@example.com",
    phone: "+506 0000 0000",
    status: "active",
    risk: "low",
    payment_terms: "Prepago total 15 días antes",
    cancellation_terms: "No reembolsable desde 15 días antes",
    preferred: true,
    last_reviewed_at: "2026-01-20",
    reviewed_by: "Operaciones Demo",
    response_time_hours: 18,
  },
];

export function supplierSummary(items: SupplierItem[]) {
  const active = items.filter((item) => item.status === "active").length;
  const review = items.filter((item) => item.status === "review_required" || item.status === "candidate").length;
  const highRisk = items.filter((item) => item.risk === "high").length;
  const preferred = items.filter((item) => item.preferred).length;
  const paused = items.filter((item) => item.status === "paused").length;
  return { total: items.length, active, review, highRisk, preferred, paused };
}
