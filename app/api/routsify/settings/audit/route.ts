import { NextResponse } from "next/server";
import { demoSettingsAuditLog } from "@/lib/settings-master";

export async function GET() {
  return NextResponse.json({ data: demoSettingsAuditLog, filters: ["fecha", "usuario", "módulo", "evento", "nivel", "entidad"], actions: ["ver_detalle", "reintentar", "marcar_resuelto", "exportar_logs"] });
}
