import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { updateCommunicationTemplate } from "@/lib/communications-server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const { templateId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });

  try {
    const data = await updateCommunicationTemplate({
      organizationId: access.organizationId,
      templateId,
      name: body.name,
      subjectTemplate: body.subjectTemplate,
      bodyTemplate: body.bodyTemplate,
      active: body.active,
    });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "communication_template_update_failed";
    return NextResponse.json({ ok: false, error: message }, { status: message.includes("not_found") ? 404 : 400 });
  }
}
