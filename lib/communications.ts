export type CommunicationChannel = "email" | "phone" | "meeting" | "client_note" | "supplier_note" | "internal";
export type CommunicationDirection = "inbound" | "outbound" | "internal";
export type CommunicationStatus = "open" | "answered" | "waiting" | "closed";

export type CommunicationItem = {
  id: string;
  case_code: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  contact: string;
  subject: string;
  summary: string;
  owner: string;
  status: CommunicationStatus;
  created_at: string;
  follow_up_at?: string;
};

export const communicationChannels: CommunicationChannel[] = ["email", "phone", "meeting", "client_note", "supplier_note", "internal"];
export const communicationStatuses: CommunicationStatus[] = ["open", "answered", "waiting", "closed"];

export const demoCommunications: CommunicationItem[] = [
  { id: "com-1", case_code: "EXP-2026-0001", channel: "email", direction: "outbound", contact: "Laura Martín", subject: "Solicitud de documento pendiente", summary: "Se pide documentación mínima del acompañante para poder preparar contrato.", owner: "Operaciones Demo", status: "waiting", created_at: "2026-02-12 10:30", follow_up_at: "2026-02-14" },
  { id: "com-2", case_code: "EXP-2026-0001", channel: "supplier_note", direction: "outbound", contact: "Hotel Aurora Kyoto", subject: "Confirmación de costes finales", summary: "Pendiente respuesta del proveedor sobre coste final y condiciones.", owner: "Operaciones Demo", status: "open", created_at: "2026-02-12 11:05", follow_up_at: "2026-02-13" },
  { id: "com-3", case_code: "EXP-2026-0002", channel: "meeting", direction: "inbound", contact: "Carlos y Ana Vega", subject: "Revisión de propuesta", summary: "Cliente confirma interés y pide aclarar servicios incluidos antes de aceptar.", owner: "Ventas Demo", status: "answered", created_at: "2026-02-11 18:20" },
  { id: "com-4", case_code: "EXP-2026-0002", channel: "internal", direction: "internal", contact: "Facturación", subject: "Revisión de borrador", summary: "No sincronizar documento fiscal hasta validar cobro final.", owner: "Facturación Demo", status: "open", created_at: "2026-02-12 09:00" },
];

export function communicationSummary(items: CommunicationItem[]) {
  const open = items.filter((item) => item.status === "open" || item.status === "waiting").length;
  const waiting = items.filter((item) => item.status === "waiting").length;
  const closed = items.filter((item) => item.status === "closed").length;
  return { total: items.length, open, waiting, closed };
}
