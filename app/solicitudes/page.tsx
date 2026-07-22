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
  complete: "Formulario + llamada",
  call_only: "Solo llamada",
  form_only: "Solo formulario",
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
        description="Fillout y las reservas se cruzan en una sola oportunidad. Cada caja muestra qué señal falta y permite registrar el siguiente paso manual."
      />

      <section className="lead-summary" aria-label="Resumen de solicitudes">
        <Summary href="/solicitudes?status=complete" label="Formulario + llamada" hint="Listos para convertir" value={data.stats.complete} active={data.filter === "complete"} tone="ready" />
        <Summary href="/solicitudes?status=call_only" label="Solo llamada" hint="Enviar formulario" value={data.stats.callOnly} active={data.filter === "call_only"} tone="attention" />
        <Summary href="/solicitudes?status=form_only" label="Solo formulario" hint="Enviar reserva" value={data.stats.formOnly} active={data.filter === "form_only"} tone="attention" />
        <Summary href="/solicitudes" label="Todas pendientes" hint="Bandeja completa" value={data.stats.active} active={data.filter === "active"} />
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

function Summary({ href, label, hint, value, active, tone = "" }: { href: string; label: string; hint: string; value: number; active: boolean; tone?: string }) {
  return <Link className={["lead-summary-card", active ? "active" : "", tone ? `tone-${tone}` : ""].filter(Boolean).join(" ")} href={href}><span>{label}</span><strong>{value}</strong><small>{hint}</small></Link>;
}
