import { NextResponse } from "next/server";
import { getCaseDetail } from "@/lib/case-master";

export async function GET(_: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const detail = getCaseDetail(decodeURIComponent(caseId));
  if (!detail) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  return NextResponse.json({ data: detail.timeline });
}

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const body = await request.json();
  const detail = getCaseDetail(decodeURIComponent(caseId));
  if (!detail) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  return NextResponse.json({ ok: true, event: { id: `timeline-${Date.now()}`, caseId: detail.expediente.id, type: body.type || "manual", title: body.title || "Evento manual", description: body.description, userName: "María García", createdAt: "Ahora" } }, { status: 201 });
}
