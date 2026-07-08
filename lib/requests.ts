export type RequestStatus = "new" | "qualified" | "call_scheduled" | "converted" | "discarded";
export type RequestSource = "fillout" | "booking_api" | "email" | "manual";

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
  notes?: string;
};

export const requestStatuses: RequestStatus[] = ["new", "qualified", "call_scheduled", "converted", "discarded"];
export const requestSources: RequestSource[] = ["fillout", "booking_api", "email", "manual"];

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
    assigned_to: "Sin asignar",
    created_at: "2026-02-12 11:40",
    notes: "Pendiente de llamada de descubrimiento.",
  },
];

export function requestSummary(items: RequestItem[]) {
  const fresh = items.filter((item) => item.status === "new").length;
  const qualified = items.filter((item) => item.status === "qualified" || item.status === "call_scheduled").length;
  const converted = items.filter((item) => item.status === "converted").length;
  return { total: items.length, fresh, qualified, converted };
}
