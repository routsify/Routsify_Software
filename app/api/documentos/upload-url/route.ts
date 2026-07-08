import { NextRequest, NextResponse } from "next/server";
import { createCaseDocumentUploadUrl } from "@/lib/storage-server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { organizationId?: string; caseCode?: string; fileName?: string } | null;
  if (!body?.organizationId || !body.caseCode || !body.fileName) {
    return NextResponse.json({ ok: false, error: "organizationId_caseCode_fileName_required" }, { status: 400 });
  }

  const result = await createCaseDocumentUploadUrl({ organizationId: body.organizationId, caseCode: body.caseCode, fileName: body.fileName });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
