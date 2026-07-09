import type { Client } from "@/lib/types";

export type HoldedClientStatus = "sincronizado" | "pendiente" | "con_error" | "sin_datos";
export type ClientOrigin = "Web" | "Fillout" | "Booking" | "Referral" | "Agencia" | "Manual";

export type ClientMaster = Client & {
  origin: ClientOrigin;
  owner: string;
  accepted_value: number;
  cases_count: number;
  active_cases: number;
  accepted_proposals: number;
  payments_received: number;
  holded_status: HoldedClientStatus;
  holded_last_sync?: string;
  holded_last_error?: string;
  fiscal_name?: string;
  fiscal_country?: string;
  fiscal_email?: string;
  fiscal_validated: boolean;
  first_contact_at: string;
  last_contact_at: string;
  duplicate_status: "unique" | "possible_duplicate";
  possible_duplicate_of?: string;
  status: "active" | "inactive";
};

export type ClientDraftInput = {
  display_name: string;
  email: string;
  phone: string;
  origin: ClientOrigin;
  owner: string;
  tax_id: string;
  billing_address: string;
  fiscal_email: string;
};

export const demoClientMasters: ClientMaster[] = [
  {
    id: "client-juan-perez",
    display_name: "Juan Pérez",
    client_type: "person",
    first_name: "Juan",
    last_name: "Pérez",
    email: "juan.perez@email.com",
    email_normalized: "juan.perez@email.com",
    phone: "+34 600 123 456",
    phone_normalized: "34600123456",
    tax_id: "12345678A",
    billing_address: "Calle Gran Vía, 28, 5º A · 28013 Madrid, España",
    country: "ES",
    language: "es",
    source: "Web",
    origin: "Web",
    holded_contact_id: "holded-contact-001",
    owner: "Laura Pérez",
    accepted_value: 18250,
    cases_count: 7,
    active_cases: 2,
    accepted_proposals: 5,
    payments_received: 12100,
    holded_status: "sincronizado",
    holded_last_sync: "23 May, 09:15",
    fiscal_name: "Juan Pérez",
    fiscal_country: "España",
    fiscal_email: "facturacion@juanperez.com",
    fiscal_validated: true,
    first_contact_at: "12 Ene, 2024",
    last_contact_at: "23 May, 2024",
    duplicate_status: "unique",
    status: "active",
    notes: "Ficha maestra activa. Toda la actividad se centraliza aquí.",
  },
  {
    id: "client-ana-lopez",
    display_name: "Ana López",
    client_type: "person",
    first_name: "Ana",
    last_name: "López",
    email: "ana.lopez@email.com",
    email_normalized: "ana.lopez@email.com",
    phone: "+34 611 456 789",
    phone_normalized: "34611456789",
    tax_id: "",
    billing_address: "Barcelona, España",
    country: "ES",
    language: "es",
    source: "Referral",
    origin: "Referral",
    holded_contact_id: "",
    owner: "Diego Romero",
    accepted_value: 14500,
    cases_count: 5,
    active_cases: 1,
    accepted_proposals: 3,
    payments_received: 6500,
    holded_status: "pendiente",
    fiscal_country: "España",
    fiscal_email: "",
    fiscal_validated: false,
    first_contact_at: "02 Feb, 2024",
    last_contact_at: "20 May, 2024",
    duplicate_status: "unique",
    status: "active",
  },
  {
    id: "client-carlos-ruiz",
    display_name: "Carlos Ruiz",
    client_type: "company",
    company_name: "Carlos Ruiz SL",
    email: "carlos.ruiz@empresa.com",
    email_normalized: "carlos.ruiz@empresa.com",
    phone: "+34 622 111 400",
    phone_normalized: "34622111400",
    tax_id: "B12345670",
    billing_address: "Paseo de la Castellana 40, Madrid",
    country: "ES",
    language: "es",
    source: "Agencia",
    origin: "Agencia",
    holded_contact_id: "holded-contact-003",
    owner: "Sofía Martínez",
    accepted_value: 22800,
    cases_count: 9,
    active_cases: 3,
    accepted_proposals: 6,
    payments_received: 18300,
    holded_status: "sincronizado",
    holded_last_sync: "23 May, 08:41",
    fiscal_name: "Carlos Ruiz SL",
    fiscal_country: "España",
    fiscal_email: "admin@empresa.com",
    fiscal_validated: true,
    first_contact_at: "18 Nov, 2023",
    last_contact_at: "22 May, 2024",
    duplicate_status: "unique",
    status: "active",
  },
  {
    id: "client-lucia-martin",
    display_name: "Lucía Martín",
    client_type: "person",
    first_name: "Lucía",
    last_name: "Martín",
    email: "lucia.martin@email.com",
    email_normalized: "lucia.martin@email.com",
    phone: "+34 600 111 222",
    phone_normalized: "34600111222",
    tax_id: "",
    billing_address: "",
    country: "ES",
    language: "es",
    source: "Web",
    origin: "Web",
    holded_contact_id: "holded-contact-error-004",
    owner: "Laura Pérez",
    accepted_value: 9750,
    cases_count: 3,
    active_cases: 1,
    accepted_proposals: 2,
    payments_received: 2000,
    holded_status: "con_error",
    holded_last_sync: "22 May, 18:20",
    holded_last_error: "NIF fiscal requerido antes de actualizar contacto.",
    fiscal_validated: false,
    first_contact_at: "04 Mar, 2024",
    last_contact_at: "22 May, 2024",
    duplicate_status: "possible_duplicate",
    possible_duplicate_of: "client-juan-perez",
    status: "active",
  },
  {
    id: "client-familia-gomez",
    display_name: "Familia Gómez",
    client_type: "person",
    email: "familia.gomez@email.com",
    email_normalized: "familia.gomez@email.com",
    phone: "+34 633 888 111",
    phone_normalized: "34633888111",
    tax_id: "87654321B",
    billing_address: "Valencia, España",
    country: "ES",
    language: "es",
    source: "Referral",
    origin: "Referral",
    holded_contact_id: "holded-contact-005",
    owner: "Carlos Vega",
    accepted_value: 28600,
    cases_count: 11,
    active_cases: 4,
    accepted_proposals: 7,
    payments_received: 24100,
    holded_status: "sincronizado",
    holded_last_sync: "22 May, 16:10",
    fiscal_name: "Familia Gómez",
    fiscal_country: "España",
    fiscal_email: "gomez.facturas@email.com",
    fiscal_validated: true,
    first_contact_at: "08 Oct, 2023",
    last_contact_at: "21 May, 2024",
    duplicate_status: "unique",
    status: "active",
  },
  {
    id: "client-miguel-torres",
    display_name: "Miguel Torres",
    client_type: "person",
    email: "miguel.torres@email.com",
    email_normalized: "miguel.torres@email.com",
    phone: "+34 644 999 221",
    phone_normalized: "34644999221",
    tax_id: "",
    billing_address: "Sevilla, España",
    country: "ES",
    language: "es",
    source: "Web",
    origin: "Web",
    holded_contact_id: "",
    owner: "Sofía Martínez",
    accepted_value: 12300,
    cases_count: 4,
    active_cases: 1,
    accepted_proposals: 2,
    payments_received: 3000,
    holded_status: "pendiente",
    fiscal_country: "España",
    fiscal_validated: false,
    first_contact_at: "19 Abr, 2024",
    last_contact_at: "23 May, 2024",
    duplicate_status: "unique",
    status: "active",
  },
  {
    id: "client-sofia-ramirez",
    display_name: "Sofía Ramírez",
    client_type: "person",
    email: "sofia.ramirez@email.com",
    email_normalized: "sofia.ramirez@email.com",
    phone: "+34 655 123 900",
    phone_normalized: "34655123900",
    tax_id: "98765432Z",
    billing_address: "Bilbao, España",
    country: "ES",
    language: "es",
    source: "Agencia",
    origin: "Agencia",
    holded_contact_id: "holded-contact-007",
    owner: "Diego Romero",
    accepted_value: 17450,
    cases_count: 6,
    active_cases: 2,
    accepted_proposals: 4,
    payments_received: 9200,
    holded_status: "sincronizado",
    holded_last_sync: "23 May, 11:08",
    fiscal_name: "Sofía Ramírez",
    fiscal_country: "España",
    fiscal_email: "sofia.facturas@email.com",
    fiscal_validated: true,
    first_contact_at: "30 Ene, 2024",
    last_contact_at: "20 May, 2024",
    duplicate_status: "unique",
    status: "active",
  },
  {
    id: "client-david-ortega",
    display_name: "David Ortega",
    client_type: "person",
    email: "david.ortega@email.com",
    email_normalized: "david.ortega@email.com",
    phone: "+34 600 123 456",
    phone_normalized: "34600123456",
    tax_id: "",
    billing_address: "",
    country: "ES",
    language: "es",
    source: "Web",
    origin: "Web",
    holded_contact_id: "holded-contact-error-008",
    owner: "Carlos Vega",
    accepted_value: 8780,
    cases_count: 2,
    active_cases: 1,
    accepted_proposals: 1,
    payments_received: 1500,
    holded_status: "con_error",
    holded_last_sync: "21 May, 13:47",
    holded_last_error: "Teléfono coincide con Juan Pérez. Revisar duplicado antes de sincronizar.",
    fiscal_validated: false,
    first_contact_at: "11 May, 2024",
    last_contact_at: "23 May, 2024",
    duplicate_status: "possible_duplicate",
    possible_duplicate_of: "client-juan-perez",
    status: "active",
  },
];

export function normalizeClientEmail(email?: string | null) {
  return email?.trim().toLowerCase() || "";
}

export function normalizeClientPhone(phone?: string | null) {
  return phone?.replace(/\D/g, "") || "";
}

export function formatClientMoney(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

export function clientInitials(client: ClientMaster) {
  return client.display_name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function clientFiscalMissing(client: ClientMaster) {
  const missing: string[] = [];
  if (!client.fiscal_name && !client.display_name) missing.push("nombre fiscal");
  if (!client.tax_id) missing.push("NIF/DNI/CIF");
  if (!client.billing_address) missing.push("dirección fiscal");
  if (!client.fiscal_country && !client.country) missing.push("país fiscal");
  if (!client.fiscal_email && !client.email) missing.push("email facturación");
  return missing;
}

export function possibleDuplicate(client: ClientMaster, clients = demoClientMasters) {
  const email = normalizeClientEmail(client.email);
  const phone = normalizeClientPhone(client.phone);
  return clients.find((candidate) => candidate.id !== client.id && Boolean((email && normalizeClientEmail(candidate.email) === email) || (phone && normalizeClientPhone(candidate.phone) === phone)));
}

export function clientAlerts(client: ClientMaster, clients = demoClientMasters) {
  const duplicate = possibleDuplicate(client, clients);
  const fiscalMissing = clientFiscalMissing(client);
  const alerts: string[] = [];
  if (duplicate) alerts.push(`Posible duplicado con ${duplicate.display_name}`);
  if (fiscalMissing.length) alerts.push(`Faltan datos fiscales: ${fiscalMissing.join(", ")}`);
  if (client.holded_status === "con_error") alerts.push(client.holded_last_error || "Holded devuelve error");
  if (client.accepted_proposals > 0 && fiscalMissing.length) alerts.push("Presupuesto aceptado sin datos fiscales completos");
  if (client.payments_received > 0 && client.holded_status !== "sincronizado") alerts.push("Pago recibido con cliente no sincronizado en Holded");
  return alerts;
}

export function clientKpis(clients = demoClientMasters) {
  return {
    active: clients.filter((client) => client.status === "active").length,
    pendingSync: clients.filter((client) => client.holded_status === "pendiente" || client.holded_status === "sin_datos").length,
    acceptedValue: clients.reduce((sum, client) => sum + client.accepted_value, 0),
    duplicates: clients.filter((client) => client.duplicate_status === "possible_duplicate" || possibleDuplicate(client, clients)).length,
  };
}

export function createDemoClient(input: ClientDraftInput, clients = demoClientMasters) {
  const email = normalizeClientEmail(input.email);
  const phone = normalizeClientPhone(input.phone);
  const existing = clients.find((client) => Boolean((email && normalizeClientEmail(client.email) === email) || (phone && normalizeClientPhone(client.phone) === phone)));
  if (existing) return { ok: false as const, reason: `Posible duplicado: ${existing.display_name}`, existing };

  const client: ClientMaster = {
    id: `client-demo-${Date.now()}`,
    display_name: input.display_name.trim(),
    client_type: "person",
    email: input.email.trim() || null,
    email_normalized: email,
    phone: input.phone.trim() || null,
    phone_normalized: phone,
    tax_id: input.tax_id.trim() || null,
    billing_address: input.billing_address.trim(),
    country: "ES",
    language: "es",
    source: input.origin,
    origin: input.origin,
    holded_contact_id: "",
    owner: input.owner,
    accepted_value: 0,
    cases_count: 0,
    active_cases: 0,
    accepted_proposals: 0,
    payments_received: 0,
    holded_status: input.tax_id && input.billing_address ? "pendiente" : "sin_datos",
    fiscal_name: input.display_name.trim(),
    fiscal_country: "España",
    fiscal_email: input.fiscal_email.trim() || input.email.trim() || undefined,
    fiscal_validated: Boolean(input.tax_id && input.billing_address),
    first_contact_at: "Hoy",
    last_contact_at: "Hoy",
    duplicate_status: "unique",
    status: "active",
  };

  return { ok: true as const, client };
}

export function filterClientMasters(clients: ClientMaster[], filters: { query: string; origin: string; holded: string; owner: string; issue: string }) {
  const query = filters.query.trim().toLowerCase();
  return clients.filter((client) => {
    const queryMatch = !query || [client.display_name, client.email, client.phone, client.tax_id, client.owner].some((value) => String(value ?? "").toLowerCase().includes(query));
    const originMatch = filters.origin === "Todos" || client.origin === filters.origin;
    const holdedMatch = filters.holded === "Todos" || client.holded_status === filters.holded;
    const ownerMatch = filters.owner === "Todos" || client.owner === filters.owner;
    const issueMatch = filters.issue === "Todos" || (filters.issue === "Duplicados" && clientAlerts(client, clients).some((alert) => alert.includes("duplicado"))) || (filters.issue === "Sin fiscal" && clientFiscalMissing(client).length > 0) || (filters.issue === "Con error" && client.holded_status === "con_error") || (filters.issue === "Aceptados" && client.accepted_proposals > 0);
    return queryMatch && originMatch && holdedMatch && ownerMatch && issueMatch;
  });
}

export function simulateHoldedSync(client: ClientMaster) {
  const missing = clientFiscalMissing(client);
  if (missing.length) {
    return { ...client, holded_status: "con_error" as const, holded_last_error: `No se puede sincronizar: falta ${missing.join(", ")}`, holded_last_sync: "Ahora" };
  }
  return { ...client, holded_status: "sincronizado" as const, holded_last_error: "", holded_last_sync: "Ahora", holded_contact_id: client.holded_contact_id || `holded-${client.id}` };
}
