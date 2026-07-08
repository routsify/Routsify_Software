export type ProposalVersionStatus = "draft" | "sent" | "accepted" | "internal_review" | "lost" | "expired";

export type ProposalVersion = {
  id: string;
  version_number: number;
  status: ProposalVersionStatus;
  created_at: string;
  sent_at?: string;
  accepted_at?: string;
  expires_at?: string;
  locked: boolean;
  snapshot_note: string;
};

export const proposalStatuses: ProposalVersionStatus[] = ["draft", "sent", "accepted", "internal_review", "lost", "expired"];

export const demoProposalVersions: ProposalVersion[] = [
  {
    id: "proposal-version-1",
    version_number: 1,
    status: "draft",
    created_at: "2026-02-10",
    expires_at: "2026-03-10",
    locked: false,
    snapshot_note: "Borrador editable. Aún no bloquea venta ni compras esperadas.",
  },
];

export function canEditVersion(version: ProposalVersion) {
  return version.status === "draft" || version.status === "internal_review";
}

export function shouldCreateNewVersion(status: ProposalVersionStatus) {
  return status === "sent" || status === "accepted";
}

export function proposalVersionSummary(version: ProposalVersion) {
  if (version.status === "accepted") return "Venta, condiciones y fórmulas bloqueadas.";
  if (version.status === "sent") return "Cualquier cambio económico debe crear nueva versión.";
  if (version.status === "internal_review") return "Permite revisar coste real sin cambiar venta aceptada.";
  if (version.status === "lost" || version.status === "expired") return "Histórico conservado sin compras activas.";
  return "Editable antes de envío o aceptación.";
}
