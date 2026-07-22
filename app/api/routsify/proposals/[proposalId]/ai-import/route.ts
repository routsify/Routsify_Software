import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { analyzeAiItinerary } from "@/lib/ai-itinerary-import-server";

export const maxDuration = 120;

export async function POST(request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { proposalId } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  try {
    const data = await analyzeAiItinerary({
      organizationId: access.organizationId,
      proposalId,
      versionId: String(body.proposal_version_id || "").trim(),
      storagePath: String(body.storage_path || "").trim(),
      fileName: String(body.file_name || "").trim(),
      sizeBytes: Number(body.size_bytes || 0),
      actorId: access.actorId || null,
    });
    return NextResponse.json({ ok: true, data }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ai_import_failed";
    const status = message === "openai_api_key_not_configured" ? 503
      : message === "openai_timeout" ? 504
        : message.includes("openai_http_429") ? 429
          : message.includes("not_found") ? 404
            : message.includes("locked") || message.includes("not_selected") ? 409
              : 400;
    return NextResponse.json({ ok: false, error: message }, { status, headers: { "cache-control": "private, no-store" } });
  }
}
