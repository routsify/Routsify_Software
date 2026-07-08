export type CaseDocumentType = "proposal" | "contract" | "traveler_id" | "supplier_invoice" | "payment" | "fiscal" | "operations";
export type CaseDocumentStatus = "missing" | "uploaded" | "reviewing" | "approved" | "rejected" | "expired";
export type CaseDocumentVisibility = "private" | "client_public" | "internal";

export type CaseDocument = {
  id: string;
  case_code: string;
  type: CaseDocumentType;
  title: string;
  file_name?: string;
  status: CaseDocumentStatus;
  owner: string;
  visibility?: CaseDocumentVisibility;
  required?: boolean;
  uploaded_at?: string;
  expires_at?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  rejection_reason?: string;
  notes?: string;
};

export const documentTypes: CaseDocumentType[] = ["proposal", "contract", "traveler_id", "supplier_invoice", "payment", "fiscal", "operations"];
export const documentStatuses: CaseDocumentStatus[] = ["missing", "uploaded", "reviewing", "approved", "rejected", "expired"];
export const documentVisibilities: CaseDocumentVisibility[] = ["private", "client_public", "internal"];

export const demoDocuments: CaseDocument[] = [
  { id: "doc-1", case_code: "EXP-2026-0001", type: "proposal", title: "Propuesta Japón v1", file_name: "propuesta-japon-v1.pdf", status: "approved", owner: "Ventas", visibility: "client_public", required: true, uploaded_at: "2026-02-02", reviewed_at: "2026-02-02", reviewed_by: "Ventas Demo" },
  { id: "doc-2", case_code: "EXP-2026-0001", type: "traveler_id", title: "Documento Laura Martín", file_name: "pasaporte-laura.pdf", status: "reviewing", owner: "Operaciones", visibility: "private", required: true, uploaded_at: "2026-02-03", expires_at: "2030-06-01" },
  { id: "doc-3", case_code: "EXP-2026-0001", type: "traveler_id", title: "Documento acompañante", status: "missing", owner: "Operaciones", visibility: "private", required: true, notes: "Pendiente de cliente." },
  { id: "doc-4", case_code: "EXP-2026-0001", type: "supplier_invoice", title: "Factura Hotel Aurora Kyoto", status: "missing", owner: "Operaciones", visibility: "private", required: true, notes: "Proveedor pendiente." },
  { id: "doc-5", case_code: "EXP-2026-0002", type: "contract", title: "Contrato Costa Rica", file_name: "contrato-costa-rica-demo.pdf", status: "uploaded", owner: "Operaciones", visibility: "private", required: true, uploaded_at: "2026-02-08" },
  { id: "doc-6", case_code: "EXP-2026-0002", type: "fiscal", title: "Borrador fiscal Costa Rica", file_name: "borrador-fiscal-costa-rica.pdf", status: "reviewing", owner: "Facturación", visibility: "internal", required: false, uploaded_at: "2026-02-10" },
];

export function documentExpired(item: CaseDocument) {
  if (!item.expires_at) return false;
  const expiresAt = new Date(item.expires_at);
  return !Number.isNaN(expiresAt.getTime()) && expiresAt < new Date();
}

export function documentBlockers(item: CaseDocument) {
  const blockers: string[] = [];
  if (item.required && item.status === "missing") blockers.push("documento obligatorio pendiente");
  if (!item.file_name && item.status !== "missing") blockers.push("falta archivo asociado");
  if (documentExpired(item) || item.status === "expired") blockers.push("documento caducado");
  if (item.status === "rejected") blockers.push(item.rejection_reason || "documento rechazado");
  if (item.visibility === "client_public" && item.status !== "approved") blockers.push("no publicar sin aprobación");
  return blockers;
}

export function canApproveDocument(item: CaseDocument) {
  return documentBlockers({ ...item, status: item.status === "uploaded" || item.status === "reviewing" ? item.status : item.status }).filter((blocker) => blocker !== "no publicar sin aprobación").length === 0 && Boolean(item.file_name);
}

export function documentNextAction(item: CaseDocument) {
  const blockers = documentBlockers(item);
  if (item.status === "approved" && blockers.length === 0) return "Aprobado y disponible según permisos.";
  if (item.status === "missing") return "Solicitar o subir documento.";
  if (item.status === "uploaded" || item.status === "reviewing") return blockers.length ? `Resolver: ${blockers.join(" · ")}.` : "Revisar y aprobar manualmente.";
  if (item.status === "rejected") return "Corregir documento y volver a subir.";
  if (item.status === "expired") return "Solicitar documento actualizado.";
  return "Revisar documento.";
}

export function documentSummary(items: CaseDocument[]) {
  const missing = items.filter((item) => item.status === "missing").length;
  const reviewing = items.filter((item) => item.status === "reviewing" || item.status === "uploaded").length;
  const approved = items.filter((item) => item.status === "approved").length;
  const expired = items.filter((item) => item.status === "expired" || documentExpired(item)).length;
  const requiredOpen = items.filter((item) => item.required && item.status !== "approved").length;
  const blocked = items.filter((item) => documentBlockers(item).length > 0).length;
  return { total: items.length, missing, reviewing, approved, expired, requiredOpen, blocked };
}
