import { NextRequest, NextResponse } from "next/server";
import { jsonAccessDenied, requireInternalAccess } from "@/lib/api-security";
import { loadBusinessIntelligence } from "@/lib/business-intelligence-server";
import { resolveOrganizationId } from "@/lib/request-context";

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function row(values: unknown[]) { return values.map(csvCell).join(";"); }

export async function GET(request: NextRequest) {
  const access = await requireInternalAccess(request);
  if (!access.ok) return jsonAccessDenied(access);
  const organizationId = await resolveOrganizationId(request, access.organizationId);
  const range = request.nextUrl.searchParams.get("range") || request.nextUrl.searchParams.get("period") || "30";
  const from = request.nextUrl.searchParams.get("from") || undefined;
  const to = request.nextUrl.searchParams.get("to") || undefined;
  try {
    const report = await loadBusinessIntelligence(organizationId, { preset: range, from, to });
    const lines = [
      row(["Informe de dirección Routsify", report.periodLabel]),
      row(["Generado", report.generatedAt]),
      "",
      row(["INDICADOR", "VALOR"]),
      row(["Clientes nuevos", report.counts.clients]),
      row(["Solicitudes", report.counts.leads]),
      row(["Llamadas reservadas", report.counts.callsBooked]),
      row(["Expedientes", report.counts.cases]),
      row(["Expedientes aceptados", report.counts.acceptedCases]),
      row(["Conversión lead a llamada", `${report.conversion.leadToCall.toFixed(1)}%`]),
      row(["Conversión lead a expediente", `${report.conversion.leadToCase.toFixed(1)}%`]),
      row(["Conversión expediente a venta", `${report.conversion.caseToAccepted.toFixed(1)}%`]),
      row(["Conversión presupuesto a venta", `${report.conversion.proposalToAccepted.toFixed(1)}%`]),
      row(["Tareas abiertas", report.taskHealth.open]),
      row(["Tareas vencidas", report.taskHealth.overdue]),
      row(["Expedientes críticos", report.caseHealth.critical]),
      "",
      row(["FINANZAS", "MONEDA", "VENTA", "COBRADO", "PENDIENTE", "COSTE REAL", "BENEFICIO REAL", "MARGEN REAL"]),
      ...report.financials.map((item) => row(["Totales", item.currency, item.acceptedSales, item.paid, item.outstanding, item.realCost, item.realProfit, `${item.realMargin.toFixed(2)}%`])),
      "",
      row(["FUENTES", "LEADS", "EXPEDIENTES", "VENTAS", "CONVERSIÓN", "VENTA"]),
      ...report.sources.map((item) => row([item.label, item.leads, item.cases, item.accepted, `${Number(item.conversion || 0).toFixed(2)}%`, item.sale])),
      "",
      row(["DESTINOS", "EXPEDIENTES", "VENTAS", "VENTA", "COSTE", "BENEFICIO", "MARGEN"]),
      ...report.destinations.map((item) => row([item.label, item.cases, item.accepted, item.sale, item.cost, item.profit, `${Number(item.margin || 0).toFixed(2)}%`])),
      "",
      row(["PROVEEDORES", "COMPRAS", "PENDIENTES", "PRESUPUESTADO", "REAL", "DESVIACIÓN"]),
      ...report.suppliers.map((item) => row([item.label, item.purchases, item.pending, item.sale, item.cost, item.deviation])),
    ];
    return new NextResponse(`\uFEFF${lines.join("\r\n")}`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="informe_routsify_${report.startDate}_${report.endDate}.csv"`, "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "report_export_failed" }, { status: 400 });
  }
}
