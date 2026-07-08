import type { Traveler } from "@/lib/travelers";

export function travelerMissingFields(item: Traveler) {
  const missing: string[] = [];
  if (!item.full_name.trim()) missing.push("nombre completo");
  if (!item.date_of_birth.trim()) missing.push("fecha de nacimiento");
  if (!item.nationality.trim()) missing.push("nacionalidad");
  if (!item.document_type.trim()) missing.push("tipo de documento");
  if (!item.document_number.trim()) missing.push("número de documento");
  if (!item.document_expiry.trim()) missing.push("caducidad");
  if (!item.document_file) missing.push("archivo");
  return missing;
}

export function documentExpired(expiry: string) {
  if (!expiry) return false;
  const date = new Date(expiry);
  return !Number.isNaN(date.getTime()) && date < new Date();
}

export function documentExpiresSoon(expiry: string, days = 180) {
  if (!expiry) return false;
  const date = new Date(expiry);
  if (Number.isNaN(date.getTime())) return false;
  const limit = new Date();
  limit.setDate(limit.getDate() + days);
  return date >= new Date() && date <= limit;
}

export function inferTravelerStatus(item: Traveler): Traveler["status"] {
  const missing = travelerMissingFields(item);
  if (missing.length > 0) return "missing";
  if (documentExpired(item.document_expiry)) return "expired";
  if (item.status === "verified") return "verified";
  return "uploaded";
}

export function travelerBlockers(item: Traveler) {
  const blockers = travelerMissingFields(item);
  if (documentExpired(item.document_expiry)) blockers.push("documento caducado");
  if (documentExpiresSoon(item.document_expiry)) blockers.push("documento caduca pronto");
  return blockers;
}

export function travelerNextAction(item: Traveler) {
  const blockers = travelerBlockers(item);
  if (item.status === "verified" && blockers.length === 0) return "Viajero validado para contrato y operación.";
  if (blockers.length > 0) return `Resolver: ${blockers.join(", ")}.`;
  if (item.status === "uploaded") return "Revisión manual pendiente.";
  return "Completar datos mínimos.";
}

export function caseTravelerReadiness(items: Traveler[]) {
  const total = items.length;
  const blockers = items.reduce((sum, item) => sum + travelerBlockers(item).length, 0);
  const verified = items.filter((item) => item.status === "verified" && travelerBlockers(item).length === 0).length;
  const uploaded = items.filter((item) => item.status === "uploaded").length;
  const ready = total > 0 && blockers === 0 && verified === total;
  return { total, verified, uploaded, blockers, ready };
}
