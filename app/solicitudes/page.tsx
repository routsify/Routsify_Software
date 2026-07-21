import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { requireAppPermission } from "@/lib/app-auth";
import { listLeadReviewPage, leadReviewFilters, type LeadReviewFilter } from "@/lib/lead-review-server";
import { hasPermission } from "@/lib/rbac";
import { LeadReviewTable } from "./LeadReviewTable";
import "./solicitudes.css";

const filterLabels: Record<LeadReviewFilter, string> = {
  active: "Pendientes",
  archived: "Archivadas",
  converted: "Convertidas",
  won: "Compraron",
  lost: "No compraron",
  all: "Todas",
};

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  const session = await requireAppPermission("clients.view");
  const params = await searchParams;
  const filter = leadReviewFilters.includes(params.status as LeadReviewFilter)
    ? params.status as LeadReviewFilter
    : "active";
  const data = await listLeadReviewPage(session.organizationId, {
    page: params.page,
    filter,
    query: params.q,
  });
  const canManage = hasPermission(session.role, "clients.manage");

  function hrefFor(next: { status?: LeadReviewFilter; page?: number }) {
    const search = new URLSearchParams();
    const status = next.status || data.filter;
    if (status !== "active") search.set("status", status);
    if (data.query) search.set("q", data.query);
    if ((next.page || 1) > 1) search.set("page", String(next.page));
    const value = search.toString();
    return value ? `/solicitudes?${value}` : "/solicitudes";
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Entrada comercial"
        title="Solicitudes"
        description="Revisa únicamente oportunidades activas. El histórico permanece disponible sin generar tareas ni alertas."
      />

      <section className="lead-summary" aria-label="Resumen de solicitudes">
        <Summary href="/solicitudes" label="Pendientes" value={data.stats.active} active={data.filter === "active"} />
        <Summary href="/solicitudes?status=converted" label="Convertidas" value={data.stats.converted} active={data.filter === "converted"} />
        <Summary href="/solicitudes?status=won" label="Compraron" value={data.stats.won} active={data.filter === "won"} />
        <Summary href="/solicitudes?status=archived" label="Archivadas" value={data.stats.archived} active={data.filter === "archived"} />
      </section>

      <form className="card lead-toolbar" action="/solicitudes" method="get">
        <label>
          <span className="sr-only">Buscar solicitudes</span>
          <input className="input" name="q" defaultValue={data.query} placeholder="Nombre, email, teléfono o destino" />
        </label>
        <label>
          <span className="sr-only">Estado</span>
          <select name="status" defaultValue={data.filter}>
            {leadReviewFilters.map((value) => <option key={value} value={value}>{filterLabels[value]}</option>)}
          </select>
        </label>
        <button className="btn" type="submit">Filtrar</button>
        {data.query || data.filter !== "active" ? <Link className="btn secondary" href="/solicitudes">Limpiar</Link> : null}
      </form>

      <LeadReviewTable initialItems={data.items} canManage={canManage} />

      {data.totalPages > 1 ? (
        <nav className="table-pagination card" aria-label="Paginación de solicitudes">
          <Link className="btn secondary" aria-disabled={data.page <= 1} href={hrefFor({ page: Math.max(1, data.page - 1) })}>Anterior</Link>
          <span>Página {data.page} de {data.totalPages} · {data.total} solicitudes</span>
          <Link className="btn secondary" aria-disabled={data.page >= data.totalPages} href={hrefFor({ page: Math.min(data.totalPages, data.page + 1) })}>Siguiente</Link>
        </nav>
      ) : null}
    </AppShell>
  );
}

function Summary({ href, label, value, active }: { href: string; label: string; value: number; active: boolean }) {
  return <Link className={active ? "lead-summary-card active" : "lead-summary-card"} href={href}><span>{label}</span><strong>{value}</strong></Link>;
}
