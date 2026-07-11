"use client";

import { FormEvent, useMemo, useState } from "react";

type CaseOption = { id: string; case_code: string; title?: string | null; destination?: string | null; clients?: { display_name?: string | null } | null };
type Line = { id: string; description_public: string; supplier_name?: string | null; cost_budget?: number | string | null; sale_price?: number | string | null; margin_applied?: number | string | null };
type Version = { id: string; version_number: number; status?: string | null; budget_lines?: Line[] | null };
type Proposal = { id: string; status?: string | null; cases?: CaseOption | null; proposal_versions?: Version[] | null };

type LineDraft = { description_public: string; supplier_name: string; cost_budget: string; margin_applied: string };
const emptyLine: LineDraft = { description_public: "", supplier_name: "", cost_budget: "", margin_applied: "20" };
const statuses = [
  ["draft", "Borrador"],
  ["internal_review", "Revisión interna"],
  ["sent", "Enviado"],
  ["accepted", "Aceptado"],
  ["rejected", "Rechazado"],
] as const;

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
function salePreview(cost: string, margin: string) { const numericCost = num(cost); const numericMargin = Math.min(Math.max(num(margin), 0), 95); return numericCost > 0 ? numericCost / (1 - numericMargin / 100) : 0; }

export function BudgetManager({ initialProposals = [], initialCases = [], initialCaseId = "" }: { initialProposals?: unknown[]; initialCases?: unknown[]; initialCaseId?: string }) {
  const [proposals, setProposals] = useState<Proposal[]>(() => initialProposals.map(asProposal));
  const [cases] = useState<CaseOption[]>(() => initialCases.map(asCase).filter((item) => item.id));
  const [selectedId, setSelectedId] = useState<string | null>(() => proposals.find((item) => item.cases?.id === initialCaseId)?.id || proposals[0]?.id || null);
  const [query, setQuery] = useState("");
  const [caseId, setCaseId] = useState(() => cases.some((item) => item.id === initialCaseId) ? initialCaseId : "");
  const [showCreate, setShowCreate] = useState(() => Boolean(initialCaseId && !proposals.some((item) => item.cases?.id === initialCaseId)));
  const [line, setLine] = useState<LineDraft>(emptyLine);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return proposals;
    return proposals.filter((proposal) => [proposal.cases?.case_code, proposal.cases?.title, proposal.cases?.destination, proposal.cases?.clients?.display_name, proposal.status].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [proposals, query]);

  const availableCases = useMemo(() => cases.filter((item) => !proposals.some((proposal) => proposal.cases?.id === item.id)), [cases, proposals]);
  const selected = proposals.find((proposal) => proposal.id === selectedId) || filtered[0] || proposals[0] || null;
  const selectedVersion = versionOf(selected);
  const selectedTotals = totals(selected);
  const pipeline = proposals.filter((proposal) => !["accepted", "rejected"].includes(String(proposal.status))).reduce((sum, proposal) => sum + totals(proposal).sale, 0);
  const preview = salePreview(line.cost_budget, line.margin_applied);

  async function createProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caseId) return setMessage("Selecciona un expediente.");
    const existing = proposals.find((proposal) => proposal.cases?.id === caseId);
    if (existing) {
      setSelectedId(existing.id);
      setShowCreate(false);
      setMessage("Ese expediente ya tiene presupuesto. Se ha abierto el existente.");
      return;
    }

    setSaving(true);
    setMessage(null);
    const response = await fetch("/api/routsify/proposals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ case_id: caseId }) });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo crear el presupuesto."));

    const created = asProposal(result.data);
    setProposals((current) => [created, ...current.filter((item) => item.id !== created.id)]);
    setSelectedId(created.id);
    setCaseId("");
    setShowCreate(false);
    setMessage("Presupuesto creado correctamente.");
  }

  async function changeStatus(proposalId: string, nextStatus: string) {
    const proposal = proposals.find((item) => item.id === proposalId);
    if (!proposal) return;
    if (["internal_review", "sent", "accepted"].includes(nextStatus) && linesOf(proposal).length === 0) {
      setMessage("Añade al menos una línea antes de avanzar el presupuesto.");
      return;
    }
    if (nextStatus === "accepted" && totals(proposal).sale <= 0) {
      setMessage("No se puede aceptar un presupuesto con venta total cero.");
      return;
    }

    setSavingId(proposalId);
    setMessage(null);
    const response = await fetch(`/api/routsify/proposals/${proposalId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
    const result = await response.json().catch(() => null);
    setSavingId(null);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo actualizar el presupuesto."));

    const updated = asProposal(result.data);
    setProposals((current) => current.map((item) => item.id === proposalId ? updated : item));
    setSelectedId(updated.id);
    setMessage("Estado actualizado correctamente.");
  }

  async function addLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !selectedVersion) return setMessage("Selecciona un presupuesto válido.");
    const description = line.description_public.trim();
    const cost = num(line.cost_budget);
    const margin = num(line.margin_applied);
    if (!description) return setMessage("La línea necesita descripción.");
    if (cost < 0) return setMessage("El coste no puede ser negativo.");
    if (margin < 0 || margin >= 100) return setMessage("El margen debe estar entre 0 y 99%. ");

    setSaving(true);
    setMessage(null);
    const response = await fetch(`/api/routsify/proposals/${selected.id}/lines`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...line, description_public: description, proposal_version_id: selectedVersion.id }),
    });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo añadir la línea."));

    setProposals((current) => current.map((proposal) => proposal.id === selected.id ? { ...proposal, proposal_versions: (proposal.proposal_versions || []).map((version) => version.id === selectedVersion.id ? { ...version, budget_lines: [...(version.budget_lines || []), result.data] } : version) } : proposal));
    setLine(emptyLine);
    setMessage("Línea añadida correctamente.");
  }

  async function removeLine(lineId: string) {
    if (!selected || !selectedVersion) return;
    if (!window.confirm("¿Eliminar esta línea del presupuesto?")) return;
    setSaving(true);
    setMessage(null);
    const response = await fetch(`/api/routsify/proposals/${selected.id}/lines/${lineId}`, { method: "DELETE" });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo eliminar la línea."));

    setProposals((current) => current.map((proposal) => proposal.id === selected.id ? { ...proposal, proposal_versions: (proposal.proposal_versions || []).map((version) => version.id === selectedVersion.id ? { ...version, budget_lines: (version.budget_lines || []).filter((item) => item.id !== lineId) } : version) } : proposal));
    setMessage("Línea eliminada correctamente.");
  }

  return (
    <div className="clients-page">
      <section className="client-kpis">
        <div className="kpi-card"><span className="kpi-icon">P</span><span className="kpi-copy"><strong>Presupuestos</strong><b>{proposals.length}</b><small>Total creados</small></span></div>
        <div className="kpi-card"><span className="kpi-icon">B</span><span className="kpi-copy"><strong>Borradores</strong><b>{proposals.filter((item) => item.status === "draft").length}</b><small>En preparación</small></span></div>
        <div className="kpi-card"><span className="kpi-icon">A</span><span className="kpi-copy"><strong>Aceptados</strong><b>{proposals.filter((item) => item.status === "accepted").length}</b><small>Cerrados con cliente</small></span></div>
        <div className="kpi-card"><span className="kpi-icon">€</span><span className="kpi-copy"><strong>Pipeline</strong><b>{money(pipeline)}</b><small>Venta abierta</small></span></div>
      </section>

      <section className="clients-layout">
        <div className="card clients-main">
          <div className="client-filters client-filters-simple">
            <input className="input" placeholder="Buscar por expediente, cliente o destino..." value={query} onChange={(event) => setQuery(event.target.value)} />
            <button className={showCreate ? "btn secondary" : "btn"} type="button" onClick={() => setShowCreate((current) => !current)} aria-expanded={showCreate}>{showCreate ? "Cerrar formulario" : "Nuevo presupuesto"}</button>
          </div>

          {showCreate ? (
            <section className="creation-panel" aria-label="Crear nuevo presupuesto">
              <div className="creation-panel-header"><div><div className="eyebrow">Nuevo presupuesto</div><h2>Vincular a expediente</h2><p>Cada expediente trabaja con un presupuesto principal y sus versiones.</p></div><button className="btn secondary" type="button" onClick={() => setShowCreate(false)} disabled={saving}>Cancelar</button></div>
              <form className="form" onSubmit={createProposal}>
                <label>Expediente *<select autoFocus required value={caseId} onChange={(event) => setCaseId(event.target.value)}><option value="">Selecciona expediente</option>{availableCases.map((item) => <option key={item.id} value={item.id}>{item.case_code} · {item.clients?.display_name || item.destination || item.title || "Expediente"}</option>)}</select></label>
                {availableCases.length === 0 ? <p className="form-warning">No hay expedientes sin presupuesto. Abre uno de los existentes en la tabla.</p> : null}
                <div className="form-actions"><button className="btn secondary" type="button" onClick={() => setShowCreate(false)} disabled={saving}>Cancelar</button><button className="btn" type="submit" disabled={saving || availableCases.length === 0}>{saving ? "Guardando..." : "Crear presupuesto"}</button></div>
              </form>
            </section>
          ) : null}

          {message ? <p className="client-message" role="status">{message}</p> : null}
          {proposals.length === 0 ? (
            <div className="empty-state"><h2>Todavía no hay presupuestos</h2><p>Crea un presupuesto desde un expediente.</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><h2>No hay coincidencias</h2><p>Cambia la búsqueda para ver otros presupuestos.</p></div>
          ) : (
            <div className="table-scroll"><table><thead><tr><th>Expediente</th><th>Cliente</th><th>Estado</th><th>Líneas</th><th>Venta</th></tr></thead><tbody>{filtered.map((proposal) => <tr key={proposal.id} className={proposal.id === selected?.id ? "selected-row" : ""}><td><button className="table-link" type="button" onClick={() => setSelectedId(proposal.id)}><strong>{proposal.cases?.case_code || "Presupuesto"}</strong></button></td><td>{proposal.cases?.clients?.display_name || "—"}</td><td><select value={proposal.status || "draft"} onChange={(event) => void changeStatus(proposal.id, event.target.value)} disabled={savingId === proposal.id}>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td>{linesOf(proposal).length}</td><td>{money(totals(proposal).sale)}</td></tr>)}</tbody></table></div>
          )}
        </div>

        <aside className="client-side card">
          {selected ? <>
            <div className="client-side-header compact"><div><h2>{selected.cases?.case_code || "Presupuesto"}</h2><p>{selected.cases?.clients?.display_name || "Sin cliente"}<br />{selected.cases?.destination || "Sin destino"}</p></div><span className="status-pill status-progress">{statusText(selected.status)}</span></div>
            <section className="side-section"><h3>Totales</h3><table><tbody><tr><th>Coste</th><td>{money(selectedTotals.cost)}</td></tr><tr><th>Venta</th><td>{money(selectedTotals.sale)}</td></tr><tr><th>Beneficio</th><td>{money(selectedTotals.profit)}</td></tr><tr><th>Margen sobre venta</th><td>{selectedTotals.margin ? `${selectedTotals.margin.toFixed(1)}%` : "—"}</td></tr></tbody></table></section>
            <section className="side-section"><h3>Líneas</h3>{linesOf(selected).length ? <div className="table-scroll"><table><tbody>{linesOf(selected).map((item) => <tr key={item.id}><td>{item.description_public}<br /><small>{item.supplier_name || "Sin proveedor"}</small></td><td>{money(item.sale_price)}</td><td><button className="link-button danger-text" type="button" onClick={() => void removeLine(item.id)} disabled={saving}>Eliminar</button></td></tr>)}</tbody></table></div> : <p>Sin líneas todavía.</p>}</section>
            <section className="side-section"><h3>Añadir línea</h3><form className="form" onSubmit={addLine}><label>Descripción *<input className="input" required value={line.description_public} onChange={(event) => setLine((current) => ({ ...current, description_public: event.target.value }))} /></label><label>Proveedor<input className="input" value={line.supplier_name} onChange={(event) => setLine((current) => ({ ...current, supplier_name: event.target.value }))} /></label><div className="grid grid-2"><label>Coste<input className="input" type="number" min="0" step="0.01" value={line.cost_budget} onChange={(event) => setLine((current) => ({ ...current, cost_budget: event.target.value }))} /></label><label>Margen sobre venta %<input className="input" type="number" min="0" max="99" step="0.1" value={line.margin_applied} onChange={(event) => setLine((current) => ({ ...current, margin_applied: event.target.value }))} /></label></div><p className="field-help">Venta calculada: <strong>{money(preview)}</strong></p><button className="btn" type="submit" disabled={saving}>{saving ? "Guardando..." : "Añadir línea"}</button></form></section>
            <section className="side-section"><h3>Estado del presupuesto</h3><select value={selected.status || "draft"} onChange={(event) => void changeStatus(selected.id, event.target.value)} disabled={savingId === selected.id}>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></section>
          </> : <div className="empty-state"><h2>Sin presupuesto seleccionado</h2><p>Selecciona o crea un presupuesto.</p></div>}
        </aside>
      </section>
    </div>
  );
}
