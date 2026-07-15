"use client";

import { FormEvent, useMemo, useState } from "react";
import { usePermission } from "@/components/PermissionProvider";

const statuses = new Map([
  ["draft", "Borrador"],
  ["internal_review", "Revisión interna"],
  ["sent", "Enviado"],
  ["accepted", "Aceptado"],
  ["rejected", "Rechazado"],
]);

type CaseOption = {
  id: string;
  case_code: string;
  title?: string | null;
  destination?: string | null;
  clients?: { display_name?: string | null } | null;
};

type CurrentVersion = {
  id?: string;
  version_number?: number | string | null;
  total_sale?: number | string | null;
  total_cost?: number | string | null;
  total_cost_budget?: number | string | null;
  budgeted_profit?: number | string | null;
};

type ProposalSummary = {
  id: string;
  status: string;
  cases?: CaseOption | null;
  current_version?: CurrentVersion | null;
};

function oneRecord<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) || null;
  return value && typeof value === "object" ? value as T : null;
}

function normalizeCase(input: unknown): CaseOption {
  const row = input as Record<string, unknown>;
  return {
    id: String(row.id || ""),
    case_code: String(row.case_code || "Expediente"),
    title: row.title ? String(row.title) : null,
    destination: row.destination ? String(row.destination) : null,
    clients: oneRecord<CaseOption["clients"]>(row.clients),
  };
}

function normalizeProposal(input: unknown): ProposalSummary {
  const row = input as Record<string, unknown>;
  return {
    id: String(row.id || ""),
    status: String(row.status || "draft"),
    cases: row.cases ? normalizeCase(oneRecord<Record<string, unknown>>(row.cases) || {}) : null,
    current_version: oneRecord<CurrentVersion>(row.current_version),
  };
}

function numberValue(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(numberValue(value));
}

export function ProposalIndexManager({ initialProposals = [], initialCases = [], initialCaseId = "" }: { initialProposals?: unknown[]; initialCases?: unknown[]; initialCaseId?: string }) {
  const canManage = usePermission("budgets.manage");
  const proposals = useMemo(() => initialProposals.map(normalizeProposal).filter((item) => item.id), [initialProposals]);
  const cases = useMemo(() => initialCases.map(normalizeCase).filter((item) => item.id), [initialCases]);
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(Boolean(initialCaseId) && canManage);
  const [caseId, setCaseId] = useState(() => cases.some((item) => item.id === initialCaseId) ? initialCaseId : "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return proposals;
    return proposals.filter((proposal) => [proposal.cases?.case_code, proposal.cases?.title, proposal.cases?.destination, proposal.cases?.clients?.display_name, proposal.status].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [proposals, query]);

  const caseIdsWithProposal = useMemo(() => new Set(proposals.map((proposal) => proposal.cases?.id).filter(Boolean)), [proposals]);
  const availableCases = useMemo(() => cases.filter((item) => !caseIdsWithProposal.has(item.id)), [cases, caseIdsWithProposal]);
  const pipeline = proposals.filter((proposal) => !["accepted", "rejected"].includes(proposal.status)).reduce((sum, proposal) => sum + numberValue(proposal.current_version?.total_sale), 0);

  async function createProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return setMessage("Tu rol tiene acceso de consulta a presupuestos.");
    if (!caseId) return setMessage("Selecciona un expediente.");
    setSaving(true);
    setMessage(null);
    const response = await fetch("/api/routsify/proposals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ case_id: caseId }),
    });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok || !result?.ok || !result?.data?.id) return setMessage(String(result?.error || "No se pudo crear el presupuesto."));
    window.location.assign(`/propuestas/editar/${encodeURIComponent(String(result.data.id))}`);
  }

  return <div className="budget-page">
    <section className="client-kpis">
      <div className="kpi-card"><span className="kpi-icon">P</span><span className="kpi-copy"><strong>Presupuestos</strong><b>{proposals.length}</b><small>Total creados</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">B</span><span className="kpi-copy"><strong>Borradores</strong><b>{proposals.filter((item) => item.status === "draft").length}</b><small>En preparación</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">A</span><span className="kpi-copy"><strong>Aceptados</strong><b>{proposals.filter((item) => item.status === "accepted").length}</b><small>Cerrados con cliente</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">€</span><span className="kpi-copy"><strong>Pipeline</strong><b>{money(pipeline)}</b><small>Venta abierta</small></span></div>
    </section>

    <section className="card budget-selector">
      <div className="client-filters client-filters-simple">
        <input className="input" placeholder="Buscar por expediente, cliente o destino..." value={query} onChange={(event) => setQuery(event.target.value)} />
        {canManage ? <button className={showCreate ? "btn secondary" : "btn"} type="button" onClick={() => setShowCreate((current) => !current)}>{showCreate ? "Cerrar formulario" : "Nuevo presupuesto"}</button> : null}
      </div>

      {showCreate && canManage ? <section className="creation-panel">
        <div className="creation-panel-header"><div><div className="eyebrow">Nuevo presupuesto</div><h2>Vincular a expediente</h2><p>Se creará un único presupuesto principal con versiones sucesivas.</p></div><button className="btn secondary" type="button" onClick={() => setShowCreate(false)}>Cancelar</button></div>
        <form className="form" onSubmit={createProposal}>
          <label>Expediente *<select autoFocus required value={caseId} onChange={(event) => setCaseId(event.target.value)}><option value="">Selecciona expediente</option>{availableCases.map((item) => <option key={item.id} value={item.id}>{item.case_code} · {item.clients?.display_name || item.destination || item.title || "Expediente"}</option>)}</select></label>
          {availableCases.length === 0 ? <p className="form-warning">No hay expedientes sin presupuesto.</p> : null}
          <div className="form-actions"><button className="btn" type="submit" disabled={saving || availableCases.length === 0}>{saving ? "Creando..." : "Crear y abrir presupuesto"}</button></div>
        </form>
      </section> : null}

      {!canManage ? <p className="client-message" role="status">Modo consulta: tu rol puede revisar presupuestos, pero no crear ni modificar versiones.</p> : null}
      {message ? <p className="client-message" role="status">{message}</p> : null}
      {proposals.length === 0 ? <div className="empty-state"><h2>Todavía no hay presupuestos</h2><p>{canManage ? "Crea un expediente y después su presupuesto." : "No hay presupuestos disponibles para consultar."}</p></div> : filtered.length === 0 ? <div className="empty-state"><h2>No hay coincidencias</h2><p>Cambia la búsqueda.</p></div> : <div className="table-scroll"><table><thead><tr><th>Expediente</th><th>Cliente</th><th>Destino</th><th>Estado</th><th>Versión</th><th>Venta</th><th></th></tr></thead><tbody>{filtered.map((proposal) => <tr key={proposal.id}><td><strong>{proposal.cases?.case_code || "Presupuesto"}</strong></td><td>{proposal.cases?.clients?.display_name || "—"}</td><td>{proposal.cases?.destination || "—"}</td><td>{statuses.get(proposal.status) || proposal.status}</td><td>v{numberValue(proposal.current_version?.version_number) || 1}</td><td>{money(proposal.current_version?.total_sale)}</td><td><a className="btn secondary" href={`/propuestas/editar/${encodeURIComponent(proposal.id)}`}>{canManage ? "Abrir" : "Consultar"}</a></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
