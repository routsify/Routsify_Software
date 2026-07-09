import { NextResponse } from "next/server";
import { demoExpedientes, expedienteKpis, filterExpedientes } from "@/lib/case-master";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || "1");
  const limit = Number(url.searchParams.get("limit") || "20");
  const filtered = filterExpedientes(demoExpedientes, {
    search: url.searchParams.get("search") || "",
    status: url.searchParams.get("status") || "Todos",
    owner: url.searchParams.get("owner") || "Todos",
    priority: url.searchParams.get("priority") || "Todos",
  });
  const start = (page - 1) * limit;
  return NextResponse.json({
    data: filtered.slice(start, start + limit),
    pagination: { page, limit, total: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / limit)) },
    kpis: expedienteKpis(filtered),
  });
}
