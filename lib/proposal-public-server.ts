import { proposal } from "@/lib/mock-data";
import { verifyProposalToken, hashProposalToken } from "@/lib/proposal-token";
import { isPublicDemoAllowed } from "@/lib/runtime-mode";

export type PublicProposalResolution =
  | { ok: true; mode: "demo" | "signed"; tokenHash: string; proposal: typeof proposal; proposalId: string; versionId: string; expiresAt?: number }
  | { ok: false; reason: "invalid" | "expired" | "not_found" };

export function resolvePublicProposal(token: string): PublicProposalResolution {
  if (token === "demo-public-token" && isPublicDemoAllowed()) {
    return { ok: true, mode: "demo", tokenHash: hashProposalToken(token), proposal, proposalId: "demo-proposal", versionId: "demo-version" };
  }

  try {
    const payload = verifyProposalToken(token);
    return { ok: true, mode: "signed", tokenHash: hashProposalToken(token), proposal, proposalId: payload.proposalId, versionId: payload.versionId, expiresAt: payload.exp };
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid";
    if (message === "token_expired") return { ok: false, reason: "expired" };
    return { ok: false, reason: "invalid" };
  }
}
