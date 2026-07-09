import type { Traveler } from "@/lib/travelers";

export type OcrConfidence = "alta" | "media" | "baja";

export type DemoOcrField = {
  field: string;
  value: string;
  confidence: OcrConfidence;
  corrected?: boolean;
};

export type DemoOcrResult = {
  status: "sin_documento" | "ocr_hecho" | "revision_requerida" | "aprobado";
  reviewer: string;
  reviewed_at?: string;
  fields: DemoOcrField[];
  alert?: string;
};

function confidenceFor(value?: string): OcrConfidence {
  if (!value) return "baja";
  if (value.length < 4) return "media";
  return "alta";
}

export function demoOcrForTraveler(item: Traveler): DemoOcrResult {
  if (!item.document_file) {
    return { status: "sin_documento", reviewer: "Operaciones", alert: "Falta cargar JPG, PNG, PDF o WEBP.", fields: [] };
  }

  const fields: DemoOcrField[] = [
    { field: "Nombre", value: item.full_name, confidence: confidenceFor(item.full_name) },
    { field: "Documento", value: item.document_number || "pendiente", confidence: confidenceFor(item.document_number), corrected: !item.document_number },
    { field: "Nacimiento", value: item.date_of_birth || "pendiente", confidence: confidenceFor(item.date_of_birth), corrected: !item.date_of_birth },
    { field: "Nacionalidad", value: item.nationality || "pendiente", confidence: confidenceFor(item.nationality) },
    { field: "Caducidad", value: item.document_expiry || "pendiente", confidence: confidenceFor(item.document_expiry), corrected: !item.document_expiry },
  ];

  const hasLow = fields.some((field) => field.confidence === "baja");
  const status = item.status === "verified" ? "aprobado" : hasLow ? "revision_requerida" : "ocr_hecho";

  return {
    status,
    reviewer: item.status === "verified" ? "Operaciones Demo" : "Pendiente",
    reviewed_at: item.status === "verified" ? new Date().toISOString().slice(0, 10) : undefined,
    alert: hasLow ? "Confianza baja: revisión humana obligatoria." : undefined,
    fields,
  };
}

export function ocrSummary(items: Traveler[]) {
  const results = items.map(demoOcrForTraveler);
  const approved = results.filter((item) => item.status === "aprobado").length;
  const review = results.filter((item) => item.status === "revision_requerida").length;
  const done = results.filter((item) => item.status === "ocr_hecho" || item.status === "aprobado").length;
  return { total: results.length, approved, review, done };
}
