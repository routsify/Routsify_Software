"use client";

import { FormEvent, useMemo, useState } from "react";

type CaseOption = { id: string; case_code: string; title?: string | null; destination?: string | null; clients?: { display_name?: string | null } | null };
type Line = { id: string; description_public: string; supplier_name?: string | null; cost_budget?: number | string | null; sale_price?: number | string | null; margin_applied?: number | string | null };
type Version = { id: string; version_number: number; budget_lines?: Line[] | null };
type Proposal = { id: string; status?: string | null; cases?: CaseOption | null; proposal_versions?: Version[] | null };

type LineDraft = { description_public: string; supplier_name: string; cost_budget: string; margin_applied: string };
const emptyLine: LineDraft = { description_public: "", supplier_name: "", cost_budget: "", margin_applied: "20" };
const statuses = [["draft", "Borrador"], ["internal_review", "Revisión interna"], ["sent", "Enviado"], ["accepted", "Aceptado"], ["rejected", "Rechazado"]];

function asCase(input: unknown): CaseOption {
  const row = input as Record<string, unknown>;
  return { id: String(row.id || ""), case_code: String(row.case_code || "Expediente"), title: row.title ? String(row.title) : null, destination: row.destination ? String(row.destination) : null, clients: row.clients && typeof row.clients === "object" ? row.clients as CaseOption["clients"] : null };
}

function asProposal(input: unknown): Proposal {
  const row = input as Record<string, unknown>;
  return { id: String(row.id || crypto.randomUUID()), status: row.status ? String(row.status) : "draft", cases: row.cases && typeof row.cases === "object" ? asCase(row.cases) : null, proposal_versions: Array.isArray(row.proposal_versions) ? row.proposal_versions as Version[] : [] };
}

function versionOf(proposal?: Proposal | null) { return [...(proposal?.proposal_versions || [])].sort((a, b) => Number(b.version_number || 0) - Number(a.version_number || 0))[0] || null; }
function linesOf(proposal?: Proposal | null) { return versionOf(proposal)?.budget_lines || []; }
function num(value: unknown) { const number = Number(value || 0); return Number.isFinite(number) ? number : 0; }
function money(value: unknown) { const number = num(value); return number ? new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(number) : "—"; }
function statusText(value?: string | null) { return statuses.find(([key]) => key === value)?.[1] || value || "Borrador"; }
function totals(proposal?: Proposal | null) { const lines = linesOf(proposal); const cost = lines.reduce((sum, line) => sum + num(line.cost_budget), 0); const sale = lines.reduce((sum, line) => sum + num(line.sale_price), 0); return { cost, sale, profit: sale - cost, margin: sale ? ((sale - cost) / sale) * 100 : 0 }; }

export function BudgetManager({ initialProposals = [], initialCases = [] }: { initialProposals?: unknown[]; initialCases?: unknown[] }) {
  const [proposals, setProposals] = useState<Proposal[]>(() => initialProposals.map(asProposal));
  const [cases] = useState<CaseOption[]>(() => initialCases.map(asCase).filter((item) => item.id));
  const [selectedId, setSelectedId] = useState<string | null>(() => proposals[0]?.id || null);
  const [query, setQuery] = useState("");
  const [caseId, setCaseId] = useState("");
  const [line, setLine] = useState<LineDraft>(emptyLine);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return proposals;
    return proposals.filter((proposal) => [proposal.cases?.case_code, proposal.cases?.title, proposal.cases?.destination, proposal.cases?.clients?.display_name, proposal.status].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [proposals, query]);

  const selected = proposals.find((proposal) => proposal.id === selectedId) || filtered[0] || proposals[0] || null;
  const selectedVersion = versionOf(selected);
  const selectedTotals = totals(selected);
  const pipeline = proposals.reduce((sum, proposal) => sum + totals(proposal).sale, 0);

  async function createProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caseId) return setMessage("Selecciona un expediente.");
    setSaving(true);
    const response = await fetch("/api/routsify/proposals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ case_id: caseId }) });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok || !result?.ok) return setMessage("No se pudo crear el presupuesto.");
    const created = asProposal(result.data);
    setProposals((current) => [created, ...current.filter((item) => item.id !== created.id)]);
    setSelectedId(created.id);
    setCaseId("");
    setMessage("Presupuesto creado correctamente.");
  }

  async function changeStatus(proposalId: string, status: string) {
    setSaving(true);
    const response = await fetch(`/api/routsify/proposals/${proposalId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok || !result?.ok) return setMessage("No se pudo actualizar el presupuesto.");
    const updated = asProposal(result.data);
    setProposals((current) => current.map((item) => item.id === proposalId ? updated : item));
    setSelectedId(updated.id);
    setMessage("Estado actualizado correctamente.");
  }

  async function addLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !selectedVersion) return;
    if (!line.description_public.trim()) return setMessage("La línea necesita descripción.");
    setSaving(true);
    const response = await fetch(`/api/routsify/proposals/${selected.id}/lines`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...line, proposal_version_id: selectedVersion.id }) });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok || !result?.ok) return setMessage("No se pudo añadir la línea.");
    setProposals((current) => current.map((proposal) => proposal.id === selected.id ? { ...proposal, proposal_versions: (proposal.proposal_versions || []).map((version) => version.id === selectedVersion.id ? { ...version, budget_lines: [...(version.budget_lines || []), result.data] } : version) } : proposal));
    setLine(emptyLine);
    setMessage("Línea añadida correctamente.");
  }

  async function removeLine(lineId: string) {
    if (!selected || !selectedVersion) return;
    setSaving(true);
    const response = await fetch(`/api/routsify/proposals/${selected.id}/lines/${lineId}`, { method: "DELETE" });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok || !result?.ok) return setMessage("No se pudo eliminar la línea.");
    setProposals((current) => current.map((proposal) => proposal.id === selected.id ? { ...proposal, proposal_versions: (proposal.proposal_versions || []).map((version) => version.id === selectedVersion.id ? { ...version, budget_lines: (version.budget_lines || []).filter((item) => item.id !== lineId) } : version) } : proposal));
    setMessage("Línea eliminada correctamente.");
  }

  return (
    <div className="clients-page">
      <section className="client-kpis"><div className="kpi-card"><span className="kpi-icon">P</span><span className="kpi-copy"><strong>Presupuestos</strong><b>{proposals.length}</b><small>Total creados</small></span></div><div className="kpi-card"><span className="kpi-icon">B</span><span className="kpi-copy"><strong>Borradores</strong><b>{proposals.filter((item) => item.status === "draft").length}</b><small>En preparación</small></span></div><div className="kpi-card"><span className="kpi-icon">A</span><span className="kpi-copy"><strong>Aceptados</strong><b>{proposals.filter((item) => item.status === "accepted").length}</b><small>Cerrados con cliente</small></span></div><div className="kpi-card"><span className="kpi-icon">€</span><span className="kpi-copy"><strong>Pipeline</strong><b>{money(pipeline)}</b><small>Venta presupuestada</small></span></div></section>
      <section className="clients-layout">
        <div className="card clients-main"><div className="client-filters client-filters-simple"><input className="input" placeholder="Buscar presupuesto..." value={query} onChange={(event) => setQuery(event.target.value)} /><details className="new-client-drawer"><summary className="btn">Nuevo presupuesto</summary><form className="form" onSubmit={createProposal}><label>Expediente<select value={caseId} onChange={(event) => setCaseId(event.target.value)}><option value="">Selecciona expediente</option>{cases.map((item) => <option key={item.id} value={item.id}>{item.case_code} · {item.clients?.display_name || item.destination || item.title || "Expediente"}</option>)}</select></label>{cases.length === 0 ? <p className="client-message">Primero crea un expediente.</p> : null}<button className="btn" type="submit" disabled={saving || cases.length === 0}>{saving ? "Guardando..." : "Crear presupuesto"}</button></form></details></div>{message ? <p className="client-message">{message}</p> : null}{proposals.length === 0 ? <div className="empty-state"><h2>Todavía no hay presupuestos</h2><p>Crea un presupuesto desde un expediente.</p></div> : <table><thead><tr><th>Expediente</th><th>Cliente</th><th>Estado</th><th>Líneas</th><th>Venta</th></tr></thead><tbody>{filtered.map((proposal) => <tr key={proposal.id} className={proposal.id === selected?.id ? "selected-row" : ""}><td><button className="table-link" type="button" onClick={() => setSelectedId(proposal.id)}><strong>{proposal.cases?.case_code || "Presupuesto"}</strong></button></td><td>{proposal.cases?.clients?.display_name || "—"}</td><td><select value={proposal.status || "draft"} onChange={(event) => void changeStatus(proposal.id, event.target.value)} disabled={saving}>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td>{linesOf(proposal).length}</td><td>{money(totals(proposal).sale)}</td></tr>)}</tbody></table>}</div>
        <aside className="client-side card">{selected ? <><div className="client-side-header"><div><h2>{selected.cases?.case_code || "Presupuesto"}</h2><p>{selected.cases?.clients?.display_name || "Sin cliente"}<br />{selected.cases?.destination || "Sin destino"}</p></div><span className="status-pill status-progress">{statusText(selected.status)}</span></div><section className="side-section"><h3>Totales</h3><table><tbody><tr><th>Coste</th><td>{money(selectedTotals.cost)}</td></tr><tr><th>Venta</th><td>{money(selectedTotals.sale)}</td></tr><tr><th>Beneficio</th><td>{money(selectedTotals.profit)}</td></tr><tr><th>Margen</th><td>{selectedTotals.margin ? `${selectedTotals.margin.toFixed(1)}%` : "—"}</td></tr></tbody></table></section><section className="side-section"><h3>Líneas</h3>{linesOf(selected).length ? <table><tbody>{linesOf(selected).map((item) => <tr key={item.id}><td>{item.description_public}<br /><small>{item.supplier_name || "Sin proveedor"}</small></td><td>{money(item.sale_price)}</td><td><button className="link-button" type="button" onClick={() => void removeLine(item.id)} disabled={saving}>Eliminar</button></td></tr>)}</tbody></table> : <p>Sin líneas todavía.</p>}</section><section className="side-section"><h3>Añadir línea</h3><form className="form" onSubmit={addLine}><label>Descripción<input className="input" value={line.description_public} onChange={(event) => setLine((current) => ({ ...current, description_public: event.target.value }))} /></label><label>Proveedor<input className="input" value={line.supplier_name} onChange={(event) => setLine((current) => ({ ...current, supplier_name: event.target.value }))} /></label><div className="grid grid-2"><label>Coste<input className="input" type="number" value={line.cost_budget} onChange={(event) => setLine((current) => ({ ...current, cost_budget: event.target.value }))} /></label><label>Margen %<input className="input" type="number" value={line.margin_applied} onChange={(event) => setLine((current) => ({ ...current, margin_applied: event.target.value }))} /></label></div><button className="btn" type="submit" disabled={saving}>{saving ? "Guardando..." : "Añadir línea"}</button></form></section><section className="side-actions"><h3>Estado</h3>{statuses.map(([value, label]) => <button key={value} className={value === selected.status ? "quick-action primary" : "quick-action"} type="button" onClick={() => void changeStatus(selected.id, value)} disabled={saving}>{label}<span>→</span></button>)}</section></> : <div className="empty-state"><h2>Sin presupuesto seleccionado</h2><p>Selecciona o crea un presupuesto.</p></div>}</aside>
      </section>
    </div>
  );
}
