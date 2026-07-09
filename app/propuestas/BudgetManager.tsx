"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  BudgetMaster,
  BudgetStatus,
  budgetAlerts,
  budgetKpis,
  budgetOwners,
  budgetStatusConfig,
  budgetStatuses,
  buildBudgetFlow,
  calculateSalePrice,
  createDemoBudget,
  demoBudgetLines,
  demoBudgetVersions,
  demoBudgets,
  filterBudgets,
  formatBudgetMoney,
  formatBudgetPercent,
  marginFilters,
} from "@/lib/budget-master";

const emptyDraft = {
  clientName: "",
  caseCode: "",
  destination: "",
  responsibleName: "Laura Pérez",
  marginPct: 20,
};

function toneClass(tone: string) {
  if (tone === "green") return "status-progress";
  if (tone === "blue") return "status-progress";
  if (tone === "red") return "priority-urgent";
  return "status-pill";
}

function flowLabel(status: string) {
  if (status === "completed") return "Completado";
  if (status === "blocked") return "Bloqueado";
  return "Pendiente";
}

export function BudgetManager() {
  const [budgets, setBudgets] = useState<BudgetMaster[]>(demoBudgets);
  const [selectedId, setSelectedId] = useState(demoBudgets[0].id);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Todos");
  const [owner, setOwner] = useState("Todos");
  const [margin, setMargin] = useState("Todos");
  const [draft, setDraft] = useState(emptyDraft);
  const [message, setMessage] = useState<string | null>(null);

  const kpis = useMemo(() => budgetKpis(budgets), [budgets]);
  const filtered = useMemo(() => filterBudgets(budgets, { search, status, owner, margin }), [budgets, search, status, owner, margin]);
  const selected = budgets.find((item) => item.id === selectedId) || filtered[0] || budgets[0];
  const flow = useMemo(() => buildBudgetFlow(selected), [selected]);
  const alerts = useMemo(() => budgetAlerts(selected), [selected]);

  function updateSelected<K extends keyof BudgetMaster>(key: K, value: BudgetMaster[K]) {
    setBudgets((current) => current.map((item) => item.id === selected.id ? { ...item, [key]: value, lastActivityAt: "Ahora" } : item));
    setMessage(`Cambio demo guardado: ${String(key)}. En real genera auditoría económica.`);
  }

  function createBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.clientName.trim() || !draft.caseCode.trim()) {
      setMessage("Para crear presupuesto hacen falta cliente y expediente.");
      return;
    }
    const result = createDemoBudget(draft, budgets);
    setBudgets((current) => [result.budget, ...current]);
    setSelectedId(result.budget.id);
    setDraft(emptyDraft);
    setMessage(`Presupuesto ${result.budget.code} creado. Evento ${result.event}; tarea: ${result.task}.`);
  }

  function sendBudget() {
    if (selected.totalSalePrice <= 0) {
      setMessage("No se puede enviar: el total de venta debe ser mayor que 0.");
      return;
    }
    updateSelected("status", "sent");
    setMessage("Presupuesto enviado en demo: expediente pasa a seguimiento, se crea tarea y se prepara evento Holded.");
  }

  function acceptBudget() {
    if (!["sent", "internal_review"].includes(selected.status)) {
      setMessage("Solo se puede aceptar un presupuesto enviado o aprobado internamente.");
      return;
    }
    setBudgets((current) => current.map((item) => item.id === selected.id ? { ...item, status: "accepted", acceptedAt: "Ahora", lastActivityAt: "Ahora" } : item));
    setMessage("Presupuesto aceptado: versión bloqueada, compras esperadas generadas, viajeros activados y expediente actualizado.");
  }

  function createVersion() {
    setBudgets((current) => current.map((item) => item.id === selected.id ? { ...item, currentVersion: item.currentVersion + 1, status: "draft", lastActivityAt: "Ahora" } : item));
    setMessage("Nueva versión demo creada. Las versiones enviadas/aceptadas quedan como snapshot histórico.");
  }

  return (
    <div className="clients-page">
      <section className="client-kpis">
        <a className="kpi-card" href="#presupuestos-listado"><span className="kpi-icon">▣</span><span className="kpi-copy"><strong>Presupuestos activos</strong><b>{kpis.active}</b><small>+6 vs. mes anterior ↑</small></span></a>
        <a className="kpi-card" href="#presupuestos-listado"><span className="kpi-icon">□</span><span className="kpi-copy"><strong>Borradores</strong><b>{kpis.drafts}</b><small>Pendientes de revisión</small></span></a>
        <a className="kpi-card" href="#presupuestos-listado"><span className="kpi-icon">✈</span><span className="kpi-copy"><strong>Enviados / pendientes</strong><b>{kpis.sentPending}</b><small>A la espera de respuesta</small></span></a>
        <a className="kpi-card" href="#presupuestos-listado"><span className="kpi-icon">€</span><span className="kpi-copy"><strong>Valor presupuestado</strong><b>{formatBudgetMoney(kpis.budgetedValue)}</b><small>Pipeline económico ↑</small></span></a>
      </section>

      <section className="clients-layout">
        <div className="card clients-main" id="presupuestos-listado">
          <div className="client-filters">
            <input className="input" placeholder="Buscar presupuesto..." value={search} onChange={(event) => setSearch(event.target.value)} />
            <label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option>Todos</option>{budgetStatuses.map((item) => <option key={item} value={item}>{budgetStatusConfig[item].label}</option>)}</select></label>
            <label>Responsable<select value={owner} onChange={(event) => setOwner(event.target.value)}><option>Todos</option>{budgetOwners.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>Margen<select value={margin} onChange={(event) => setMargin(event.target.value)}>{marginFilters.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <details className="new-client-drawer">
              <summary className="btn">+ Nuevo presupuesto</summary>
              <form className="form" onSubmit={createBudget}>
                <label>Cliente<input className="input" value={draft.clientName} onChange={(event) => setDraft((current) => ({ ...current, clientName: event.target.value }))} placeholder="Juan Pérez" /></label>
                <label>Expediente<input className="input" value={draft.caseCode} onChange={(event) => setDraft((current) => ({ ...current, caseCode: event.target.value }))} placeholder="EXP-2026-0001" /></label>
                <label>Destino<input className="input" value={draft.destination} onChange={(event) => setDraft((current) => ({ ...current, destination: event.target.value }))} placeholder="Japón" /></label>
                <div className="grid grid-2"><label>Responsable<select value={draft.responsibleName} onChange={(event) => setDraft((current) => ({ ...current, responsibleName: event.target.value }))}>{budgetOwners.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Margen inicial %<input className="input" type="number" value={draft.marginPct} onChange={(event) => setDraft((current) => ({ ...current, marginPct: Number(event.target.value) }))} /></label></div>
                <button className="btn" type="submit">Crear presupuesto</button>
              </form>
            </details>
          </div>
          {message ? <p className="client-message">{message}</p> : null}

          <table>
            <thead><tr><th>Presupuesto</th><th>Cliente</th><th>Expediente</th><th>Estado</th><th>Margen</th><th>Venta</th><th>Responsable</th><th>Última actividad</th><th></th></tr></thead>
            <tbody>{filtered.map((item) => <tr key={item.id} className={item.id === selected.id ? "selected-row" : ""}><td><button className="table-link" type="button" onClick={() => setSelectedId(item.id)}><strong>{item.code}</strong></button></td><td>{item.clientName}</td><td><a href={`/expedientes/${item.caseCode}`}>{item.caseCode}</a></td><td><span className={`status-pill ${toneClass(budgetStatusConfig[item.status].tone)}`}>{budgetStatusConfig[item.status].label}</span></td><td>{formatBudgetPercent(item.expectedMarginPct)}</td><td>{formatBudgetMoney(item.totalSalePrice)}</td><td>{item.responsibleName}</td><td>{item.lastActivityAt}</td><td><details><summary className="icon-button">⋮</summary><div className="card" style={{ position: "absolute", right: 24, zIndex: 10 }}><a href="/propuestas/demo-public-token">Ver landing privada</a><br/><button className="table-link" type="button" onClick={createVersion}>Crear nueva versión</button><br/><button className="table-link" type="button" onClick={sendBudget}>Enviar al cliente</button><br/><button className="table-link" type="button" onClick={acceptBudget}>Marcar aceptado</button><br/><a href="/compras">Ver compras esperadas</a></div></details></td></tr>)}</tbody>
          </table>
          <div className="table-pagination"><span>Mostrando 1 a {filtered.length} de {budgets.length} presupuestos</span><span><button className="btn secondary">‹</button><button className="btn">1</button><button className="btn secondary">2</button><button className="btn secondary">3</button><button className="btn secondary">›</button></span></div>
        </div>

        <aside className="client-side card">
          <div className="client-side-header"><div><h2>{selected.code}</h2><p><strong>{selected.clientName}</strong> · {selected.caseCode}<br/>{selected.destination}{selected.startDate ? ` · ${selected.startDate} → ${selected.endDate}` : ""}</p></div><span className={`status-pill ${toneClass(budgetStatusConfig[selected.status].tone)}`}>{budgetStatusConfig[selected.status].label}</span></div>
          <section className="side-section"><h3>Datos rápidos</h3><table><tbody><tr><th>Versión</th><td>v{selected.currentVersion}</td></tr><tr><th>Responsable</th><td>{selected.responsibleName}</td></tr><tr><th>Margen</th><td>{formatBudgetPercent(selected.expectedMarginPct)}</td></tr><tr><th>Venta</th><td>{formatBudgetMoney(selected.totalSalePrice)}</td></tr></tbody></table></section>
          <section className="side-section"><h3>Resumen financiero</h3><table><tbody><tr><th>Coste previsto</th><td>{formatBudgetMoney(selected.totalCostBudget)}</td></tr><tr><th>Venta</th><td>{formatBudgetMoney(selected.totalSalePrice)}</td></tr><tr><th>Beneficio previsto</th><td>{formatBudgetMoney(selected.expectedProfit)}</td></tr><tr><th>Coste real</th><td>{formatBudgetMoney(selected.realCost || 0)}</td></tr><tr><th>Desviación</th><td>{formatBudgetMoney((selected.realCost || selected.totalCostBudget) - selected.totalCostBudget)}</td></tr></tbody></table></section>
          <section className="side-section"><h3>Líneas principales</h3>{demoBudgetLines.map((line) => <p key={line.id}><strong>{line.description}</strong><br/><small>{line.providerName} · coste {formatBudgetMoney(line.costBudget)} · venta {formatBudgetMoney(line.salePrice)}</small></p>)}</section>
          <section className="side-section"><h3>Versiones snapshots</h3>{demoBudgetVersions.map((version) => <p key={version.id}><span className={`status-pill ${toneClass(budgetStatusConfig[version.status as BudgetStatus].tone)}`}>v{version.versionNumber} · {budgetStatusConfig[version.status as BudgetStatus].label}</span><br/><small>{version.createdAt} · {version.summary}</small></p>)}</section>
          <section className="side-section"><h3>Estado del flujo</h3>{flow.map((step) => <p key={step.label}><span className={`status-pill ${step.status === "completed" ? "status-progress" : step.status === "blocked" ? "priority-urgent" : ""}`}>{flowLabel(step.status)}</span> <strong>{step.label}</strong></p>)}</section>
          <section className="side-section"><h3>Alertas</h3>{alerts.length ? alerts.map((alert) => <p key={alert} className="danger-text">⚠ {alert}</p>) : <p>Sin alertas críticas.</p>}</section>
          <section className="side-actions"><h3>Acciones rápidas</h3><a className="quick-action" href="/propuestas/demo-public-token">Ver presupuesto completo <span>→</span></a><button className="quick-action" type="button" onClick={() => selected.status === "accepted" ? setMessage("La versión aceptada no se edita: crea nueva versión o revisión controlada.") : setMessage(`Editor de líneas listo. Precio ejemplo: ${formatBudgetMoney(calculateSalePrice(100, selected.expectedMarginPct))}`)}>Editar líneas <span>→</span></button><button className="quick-action" type="button" onClick={createVersion}>Ver versiones <span>→</span></button><button className="quick-action primary" type="button" onClick={sendBudget}>Enviar al cliente <span>→</span></button><button className="quick-action" type="button" onClick={acceptBudget}>Marcar aceptado <span>→</span></button></section>
          <div className="client-footnote">Cada presupuesto se versiona. La versión aceptada bloquea fórmula, precio y condiciones.</div>
        </aside>
      </section>
    </div>
  );
}
