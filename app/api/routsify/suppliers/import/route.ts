import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { resolveOrganizationId } from "@/lib/request-context";
import { importSuppliersFromCsv } from "@/lib/supplier-import-server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function importErrorStatus(message: string) {
  if (["empty_import_file", "import_file_has_no_rows", "import_name_column_required", "import_fiscal_name_column_required"].includes(message)) return 400;
  if (message === "import_row_limit_exceeded") return 413;
  return 500;
}

export async function POST(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "import_file_required" }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ ok: false, error: "import_file_too_large" }, { status: 413 });
  if (!file.name.toLowerCase().endsWith(".csv")) return NextResponse.json({ ok: false, error: "import_csv_required" }, { status: 400 });

  try {
    const data = await importSuppliersFromCsv(organizationId, await file.text());
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "supplier_import_failed";
    return NextResponse.json({ ok: false, error: message }, { status: importErrorStatus(message) });
  }
}
