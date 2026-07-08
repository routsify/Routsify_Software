import type { Client } from "@/lib/types";

type CaseLike = {
  client: string;
  case_code: string;
  status: string;
  accepted_value?: number;
};

function normalizedText(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function clientContactCompleteness(client: Client) {
  const hasName = Boolean(normalizedText(client.display_name));
  const hasContact = Boolean(normalizedText(client.email) || normalizedText(client.phone));
  const hasFiscal = Boolean(normalizedText(client.tax_id) && client.billing_address && JSON.stringify(client.billing_address) !== "{}");
  const hasLanguage = Boolean(normalizedText(client.language));
  const score = [hasName, hasContact, hasFiscal, hasLanguage].filter(Boolean).length * 25;
  return { hasName, hasContact, hasFiscal, hasLanguage, score };
}

export function clientMissingFields(client: Client) {
  const completeness = clientContactCompleteness(client);
  const missing: string[] = [];
  if (!completeness.hasName) missing.push("nombre visible");
  if (!completeness.hasContact) missing.push("email o teléfono");
  if (!completeness.hasFiscal) missing.push("datos fiscales");
  if (!completeness.hasLanguage) missing.push("idioma");
  return missing;
}

export function findPossibleDuplicate(client: Client, clients: Client[]) {
  const email = normalizedText(client.email_normalized || client.email);
  const phone = normalizedText(client.phone_normalized || client.phone);
  return clients.find((candidate) => {
    if (candidate.id === client.id) return false;
    const candidateEmail = normalizedText(candidate.email_normalized || candidate.email);
    const candidatePhone = normalizedText(candidate.phone_normalized || candidate.phone);
    return Boolean((email && email === candidateEmail) || (phone && phone === candidatePhone));
  });
}

export function clientCaseStats(client: Client, cases: CaseLike[]) {
  const related = cases.filter((item) => item.client === client.display_name);
  const active = related.filter((item) => item.status !== "closed");
  const value = related.reduce((sum, item) => sum + (item.accepted_value || 0), 0);
  return { total: related.length, active: active.length, acceptedValue: value, codes: related.map((item) => item.case_code) };
}

export function clientNextAction(client: Client, clients: Client[], cases: CaseLike[]) {
  const duplicate = findPossibleDuplicate(client, clients);
  if (duplicate) return `Revisar posible duplicado con ${duplicate.display_name}.`;
  const missing = clientMissingFields(client);
  if (missing.length > 0) return `Completar ${missing.join(", ")}.`;
  const stats = clientCaseStats(client, cases);
  if (stats.active > 0) return `Tiene ${stats.active} expediente(s) activo(s). Trabajar desde expediente 360.`;
  return "Cliente completo. Crear expediente solo si hay solicitud cualificada.";
}

export function clientsSummary(clients: Client[], cases: CaseLike[]) {
  const incomplete = clients.filter((client) => clientMissingFields(client).length > 0).length;
  const duplicates = clients.filter((client) => findPossibleDuplicate(client, clients)).length;
  const activeClients = clients.filter((client) => clientCaseStats(client, cases).active > 0).length;
  return { total: clients.length, incomplete, duplicates, activeClients };
}
