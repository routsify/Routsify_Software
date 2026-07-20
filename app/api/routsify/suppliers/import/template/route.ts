import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";

export async function GET(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const csv = "nombre,categoria,email,telefono,pais,nif,direccion_fiscal,activo,notas\r\n";
  return new NextResponse(`\uFEFF${csv}`, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="plantilla_importacion_proveedores.csv"',
      "cache-control": "no-store",
    },
  });
}
