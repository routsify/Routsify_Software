export type CaseDocumentType = "proposal" | "contract" | "traveler_id" | "supplier_invoice" | "payment" | "fiscal" | "operations";
export type CaseDocumentStatus = "missing" | "uploaded" | "reviewing" | "approved" | "rejected" | "expired";

export type CaseDocument = {
  id: string;
  case_code: string;
  type: CaseDocumentType;
  title: string;
  file_name?: string;
  status: CaseDocumentStatus;
  owner: string;
  uploaded_at?: string;
  expires_at?: string;
  notes?: string;
};

export const documentTypes: CaseDocumentType[] = ["proposal", "contract", "traveler_id", "supplier_invoice", "payment", "fiscal", "operations"];
export const documentStatuses: CaseDocumentStatus[] = ["missing", "uploaded", "reviewing", "approved", "rejected", "expired"];

export const demoDocuments: CaseDocument[] = [
  { id: "doc-1", case_code: "EXP-2026-0001", type: "proposal", title: "Propuesta Japón v1", file_name: "propuesta-japon-v1.pdf", status: "approved", owner: "Ventas", uploaded_at: "2026-02-02" },
  { id: "doc-2", case_code: "EXP-2026-0001", type: "traveler_id", title: "Documento Laura Martín", file_name: "pasaporte-laura.pdf", status: "reviewing", owner: "Operaciones", uploaded_at: "2026-02-03", expires_at: "2030-06-01" },
  { id: "doc-3", case_code: "EXP-2026-0001", type: "traveler_id", title: "Documento acompañante", status: "missing", owner: "Operaciones", notes: "Pendiente de cliente." },
  { id: "doc-4", case_code: "EXP-2026-0001", type: "supplier_invoice", title: "Factura Hotel Aurora Kyoto", status: "missing", owner: "Operaciones", notes: "Proveedor pendiente." },
  { id: "doc-5", case_code: "EXP-2026-0002", type: "contract", title: "Contrato Costa Rica", file_name: "contrato-costa-rica-demo.pdf", status: "uploaded", owner: "Operaciones", uploaded_at: "2026-02-08" },
  { id: "doc-6", case_code: "EXP-2026-0002", type: "fiscal", title: "Borrador fiscal Costa Rica", file_name: "borrador-fiscal-costa-rica.pdf", status: "reviewing", owner: "Facturación", uploaded_at: "2026-02-10" },
];

export function documentSummary(items: CaseDocument[]) {
  const missing = items.filter((item) => item.status === "missing").length;
  const reviewing = items.filter((item) => item.status === "reviewing" || item.status === "uploaded").length;
  const approved = items.filter((item) => item.status === "approved").length;
  const expired = items.filter((item) => item.status === "expired").length;
  return { total: items.length, missing, reviewing, approved, expired };
}
