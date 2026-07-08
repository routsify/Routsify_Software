export type TravelerDocumentStatus = "missing" | "uploaded" | "verified" | "expired";

export type Traveler = {
  id: string;
  case_code: string;
  full_name: string;
  date_of_birth: string;
  nationality: string;
  document_type: string;
  document_number: string;
  document_expiry: string;
  document_file?: string;
  status: TravelerDocumentStatus;
  notes?: string;
};

export const documentStatuses: TravelerDocumentStatus[] = ["missing", "uploaded", "verified", "expired"];

export const demoTravelers: Traveler[] = [
  {
    id: "traveler-1",
    case_code: "EXP-2026-0001",
    full_name: "Laura Martín",
    date_of_birth: "1988-04-12",
    nationality: "ES",
    document_type: "passport",
    document_number: "PA123456",
    document_expiry: "2030-06-01",
    document_file: "pasaporte-laura.pdf",
    status: "uploaded",
    notes: "Pendiente de verificación manual.",
  },
  {
    id: "traveler-2",
    case_code: "EXP-2026-0001",
    full_name: "Acompañante demo",
    date_of_birth: "1986-09-20",
    nationality: "ES",
    document_type: "passport",
    document_number: "",
    document_expiry: "",
    status: "missing",
    notes: "Falta documento mínimo.",
  },
];

export function travelerSummary(items: Traveler[]) {
  const missing = items.filter((item) => item.status === "missing").length;
  const uploaded = items.filter((item) => item.status === "uploaded").length;
  const verified = items.filter((item) => item.status === "verified").length;
  const expired = items.filter((item) => item.status === "expired").length;
  const ready = missing === 0 && expired === 0 && items.length > 0;
  return { total: items.length, missing, uploaded, verified, expired, ready };
}
