export type RequestStatus = "new" | "qualified" | "call_scheduled" | "converted" | "discarded";
export type RequestSource = "fillout" | "booking_api" | "email" | "manual";
export type RequestPriority = "low" | "normal" | "high";

export type RequestItem = {
  id: string;
  source: RequestSource;
  client_name: string;
  email: string;
  phone: string;
  destination: string;
  travel_dates: string;
  travelers: number;
  budget_hint: string;
  status: RequestStatus;
  assigned_to: string;
  created_at: string;
  priority?: RequestPriority;
  converted_client_id?: string;
  converted_case_code?: string;
  notes?: string;
};

export const requestStatuses: RequestStatus[] = ["new", "qualified", "call_scheduled", "converted", "discarded"];
export const requestSources: RequestSource[] = ["fillout", "booking_api", "email", "manual"];
export const requestPriorities: RequestPriority[] = ["low", "normal", "high"];

export const demoRequests: RequestItem[] = [
  {
    id: "request-1",
    source: "fillout",
    client_name: "Marta Ruiz",
    email: "marta@example.com",
    phone: "+34 600 000 001",
    destination: "Japón",
    travel_dates: "Octubre 2026",
    travelers: 2,
    budget_hint: "8.000 - 10.000 EUR",
    status: "qualified",
    priority: "high",
    assigned_to: "Ventas Demo",
    created_at: "2026-02-12 09:15",
    notes: "Quiere luna de miel con hoteles boutique.",
  },
  {
    id: "request-2",
    source: "booking_api",
    client_name: "Familia Ortega",
    email: "ortega@example.com",
    phone: "+34 600 000 002",
    destination: "Costa Rica",
    travel_dates: "Agosto 2026",
    travelers: 4,
    budget_hint: "12.000 EUR",
    status: "new",
    priority: "normal",
    assigned_to: "Sin asignar",
    created_at: "2026-02-12 11:40",
    notes: "Pendiente de llamada de descubrimiento.",
  },
];

export function requestMissingFields(item: RequestItem) {
  const missing: string[] = [];
  if (!item.client_name.trim()) missing.push("nombre");
  if (!item.email.trim() && !item.phone.trim()) missing.push("contacto");
  if (!item.destination.trim()) missing.push("destino");
  if (!item.travel_dates.trim()) missing.push("fechas");
  if (!item.budget_hint.trim()) missing.push("presupuesto");
  return missing;
}

export function requestScore(item: RequestItem) {
  let score = 0;
  if (item.client_name.trim()) score += 15;
  if (item.email.trim() || item.phone.trim()) score += 20;
  if (item.destination.trim()) score += 20;
  if (item.travel_dates.trim()) score += 15;
  if (item.travelers > 0) score += 10;
  if (item.budget_hint.trim()) score += 20;
  return Math.min(score, 100);
}

export function requestNextAction(item: RequestItem) {
  if (item.status === "converted") return "Ya convertido en cliente y expediente.";
  if (item.status === "discarded") return "Archivado. No crear expediente.";
  const missing = requestMissingFields(item);
  if (missing.length > 0) return `Completar: ${missing.join(", ")}.`;
  if (item.status === "new") return "Cualificar y asignar responsable.";
  if (item.status === "qualified") return "Agendar llamada o convertir si hay encaje.";
  if (item.status === "call_scheduled") return "Tras la llamada, convertir o descartar.";
  return "Revisar solicitud.";
}

export function canConvertRequest(item: RequestItem) {
  return requestMissingFields(item).length === 0 && (item.status === "qualified" || item.status === "call_scheduled");
}

export function createCaseCodeFromRequest(index: number) {
  return `EXP-2026-${String(index + 3).padStart(4, "0")}`;
}

export function requestSummary(items: RequestItem[]) {
  const fresh = items.filter((item) => item.status === "new").length;
  const qualified = items.filter((item) => item.status === "qualified" || item.status === "call_scheduled").length;
  const converted = items.filter((item) => item.status === "converted").length;
  const highPriority = items.filter((item) => item.priority === "high").length;
  const convertible = items.filter((item) => canConvertRequest(item)).length;
  return { total: items.length, fresh, qualified, converted, highPriority, convertible };
}
