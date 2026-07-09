import { NextResponse } from "next/server";
import { getCaseDetail } from "@/lib/case-master";

export async function GET(_: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const detail = getCaseDetail(decodeURIComponent(caseId));
  if (!detail) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  return NextResponse.json(detail);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const body = await request.json();
  const detail = getCaseDetail(decodeURIComponent(caseId));
  if (!detail) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  return NextResponse.json({ ok: true, expediente: { ...detail.expediente, ...body, updatedAt: "Ahora", lastActivityAt: "Ahora" }, timelineEvent: { type: "case_updated", title: "Expediente actualizado", userName: "María García", createdAt: "Ahora" } });
}
