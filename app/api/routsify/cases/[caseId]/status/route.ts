import { NextResponse } from "next/server";
import { getCaseDetail, statusConfig } from "@/lib/case-master";

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const body = await request.json();
  const detail = getCaseDetail(decodeURIComponent(caseId));
  if (!detail) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  const nextStatus = body.status || detail.expediente.status;
  const nextAction = statusConfig[nextStatus as keyof typeof statusConfig]?.nextAction || detail.expediente.nextAction;
  return NextResponse.json({ ok: true, expediente: { ...detail.expediente, status: nextStatus, nextAction, updatedAt: "Ahora", lastActivityAt: "Ahora" }, timelineEvent: { type: "status_changed", title: "Estado cambiado", description: body.reason, userName: "María García", createdAt: "Ahora" } });
}
