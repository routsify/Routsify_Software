import { NextResponse } from "next/server";
import { budgetKpis, createDemoBudget, demoBudgets, filterBudgets } from "@/lib/budget-master";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || "1");
  const limit = Number(url.searchParams.get("limit") || "20");
  const filtered = filterBudgets(demoBudgets, {
    search: url.searchParams.get("search") || "",
    status: url.searchParams.get("status") || "Todos",
    owner: url.searchParams.get("responsibleUserId") || url.searchParams.get("owner") || "Todos",
    margin: url.searchParams.get("marginStatus") || url.searchParams.get("margin") || "Todos",
  });
  const start = (page - 1) * limit;
  return NextResponse.json({ data: filtered.slice(start, start + limit), pagination: { page, limit, total: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / limit)) }, kpis: budgetKpis(filtered) });
}

export async function POST(request: Request) {
  const body = await request.json();
  const result = createDemoBudget({ clientName: body.clientName || "Cliente demo", caseCode: body.caseCode || "EXP-DEMO", destination: body.destination || "Destino", responsibleName: body.responsibleName || "Laura Pérez", marginPct: Number(body.marginPct || 20) });
  return NextResponse.json({ ok: true, ...result }, { status: 201 });
}
