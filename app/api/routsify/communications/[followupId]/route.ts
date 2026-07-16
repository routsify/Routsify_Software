import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { updateCommunicationFollowupStatus, type CommunicationStatus } from "@/lib/communications-server";

const allowed = new Set<CommunicationStatus>(["prepared", "sent", "answered", "cancelled"]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ followupId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { followupId } = await params;
  const body = await request.json().catch(() => null);
  const status = String(body?.status || "") as CommunicationStatus;
  if (!allowed.has(status)) return NextResponse.json({ ok: false, error: "invalid_communication_status" }, { status: 400 });

  try {
    const data = await updateCommunicationFollowupStatus({
      organizationId: access.organizationId,
      followupId,
      actorId: access.actorId,
      status: status as Exclude<CommunicationStatus, "planned">,
    });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "communication_update_failed";
    return NextResponse.json({ ok: false, error: message }, { status: message.includes("not_found") ? 404 : 400 });
  }
}
