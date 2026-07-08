import type { SupplierItem } from "@/lib/suppliers";

type PurchaseLike = {
  supplier: string;
  status: string;
  amount: number;
};

function text(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function supplierMissingFields(item: SupplierItem) {
  const missing: string[] = [];
  if (!item.name.trim()) missing.push("nombre");
  if (!item.category.trim()) missing.push("categoría");
  if (!item.destination.trim()) missing.push("destino");
  if (!item.contact_name.trim()) missing.push("contacto");
  if (!item.email.trim() && !item.phone.trim()) missing.push("email o teléfono");
  if (!item.payment_terms.trim()) missing.push("condiciones de pago");
  if (!item.cancellation_terms?.trim()) missing.push("condiciones de cancelación");
  return missing;
}

export function findSupplierDuplicate(item: SupplierItem, suppliers: SupplierItem[]) {
  return suppliers.find((candidate) => candidate.id !== item.id && text(candidate.name) === text(item.name) && text(candidate.destination) === text(item.destination));
}

export function supplierPurchaseStats(item: SupplierItem, purchases: PurchaseLike[]) {
  const related = purchases.filter((purchase) => text(purchase.supplier) === text(item.name));
  const open = related.filter((purchase) => purchase.status !== "approved" && purchase.status !== "not_required" && purchase.status !== "cancelled");
  const amount = related.reduce((sum, purchase) => sum + purchase.amount, 0);
  return { total: related.length, open: open.length, amount };
}

export function supplierBlockers(item: SupplierItem, suppliers: SupplierItem[]) {
  const blockers = supplierMissingFields(item);
  if (item.status === "paused") blockers.push("proveedor pausado");
  if (item.status === "review_required") blockers.push("requiere revisión operativa");
  if (item.risk === "high") blockers.push("riesgo alto");
  if (findSupplierDuplicate(item, suppliers)) blockers.push("posible duplicado");
  return blockers;
}

export function canActivateSupplier(item: SupplierItem, suppliers: SupplierItem[]) {
  return supplierBlockers({ ...item, status: item.status === "candidate" ? "active" : item.status }, suppliers).filter((blocker) => blocker !== "requiere revisión operativa").length === 0;
}

export function supplierNextAction(item: SupplierItem, suppliers: SupplierItem[]) {
  const blockers = supplierBlockers(item, suppliers);
  if (item.status === "active" && blockers.length === 0) return "Disponible para presupuestos y compras esperadas.";
  if (blockers.length > 0) return `Resolver: ${blockers.join(" · ")}.`;
  if (item.status === "candidate") return "Validar condiciones y activar si procede.";
  return "Revisar proveedor antes de usarlo.";
}
