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
  },
];

export function supplierSummary(items: SupplierItem[]) {
  const active = items.filter((item) => item.status === "active").length;
  const review = items.filter((item) => item.status === "review_required").length;
  const highRisk = items.filter((item) => item.risk === "high").length;
  return { total: items.length, active, review, highRisk };
}
