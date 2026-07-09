"use client";

import { useMemo, useState } from "react";
import {
  ExpectedPurchase,
  approvePurchaseMatch,
  confidenceBucket,
  demoExpectedPurchases,
  filterPurchases,
  formatPurchaseMoney,
  holdedCandidate,
  markPurchaseNotRequired,
  purchaseAlerts,
  purchaseCaseFilters,
  purchaseFlow,
  purchaseKpis,
  purchaseMatchFilters,
  purchaseProviders,
  purchaseStatusConfig,
  purchaseStatuses,
  requestPurchaseInvoice,
} from "@/lib/purchase-master";

function toneClass(tone: string) {
  if (tone === "green") return "status-progress";
  if (tone === "blue") return "status-progress";
  if (tone === "amber") return "priority-normal";
  if (tone === "purple") return "status-pending";
  return "status-pill";
}

function flowLabel(status: string) {
  if (status === "completed") return "Completado";
  if (status === "in_progress") return "En curso";
  return "Pendiente";
}

export function PurchasesManager() {
  const [items, setItems] = useState<ExpectedPurchase[]>(demoExpectedPurchases);
  const [selectedId, setSelectedId] = useState(demoExpectedPurchases[1].id);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Todos");
  const [provider, setProvider] = useState("Todos");
  const [caseCode, setCaseCode] = useState("Todos");
  const [match, setMatch] = useState("Todos");
  const [notRequiredReason, setNotRequiredReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const kpis = useMemo(() => purchaseKpis(items), [items]);
  const filtered = useMemo(() => filterPurchases(items, { search, status, provider, caseCode, match }), [items, search, status, provider, caseCode, match]);
  const selected = items.find((item) => item.id === selectedId) || filtered[0] || items[0];
  const selectedCandidate = holdedCandidate(selected);
  const selectedFlow = purchaseFlow(selected);
  const selectedAlerts = purchaseAlerts(selected);

  function updatePurchase(id: string, updater: (item: ExpectedPurchase) => ExpectedPurchase) {
    setItems((current) => current.map((item) => item.id === id ? updater(item) : item));
  }

  function approveMatch(id = selected.id) {
    const item = items.find((purchase) => purchase.id === id);
    if (!item) return;
    if (!item.holdedPurchaseId) {
      setMessage("No se puede aprobar: no hay documento Holded candidato.");
      return;
    }
    updatePurchase(id, approvePurchaseMatch);
    setMessage("Match aprobado en demo: coste real actualizado, margen recalculado, timeline y auditoría generados.");
  }

  function requestInvoice(id = selected.id) {
    updatePurchase(id, requestPurchaseInvoice);
    setMessage("Factura solicitada al proveedor. Se crea tarea de seguimiento y evento en timeline demo.");
  }

  function sendManualReview(id = selected.id) {
    updatePurchase(id, (item) => ({ ...item, status: "review_needed", matchStatus: "issue", lastActivityAt: "Ahora" }));
    setMessage("Compra enviada a revisión manual. El cierre queda bloqueado hasta resolver la decisión.");
  }

  function syncHolded() {
    setItems((current) => current.map((item) => item.matchStatus === "none" ? { ...item, status: "holded_candidate", matchStatus: "candidate", holdedPurchaseId: `holded-${item.code}`, holdedDocumentNumber: `FAC-${item.code.replace("COMP-", "")}`, holdedAmount: item.expectedAmount, holdedDate: "Ahora", matchConfidence: 86, lastActivityAt: "Ahora" } : item));
    setMessage("Sincronización Holded demo completada sin duplicar documentos ya vinculados.");
  }

  function markNotRequired() {
    if (!notRequiredReason.trim()) {
      setMessage("No se puede marcar como no requerida sin motivo obligatorio.");
      return;
    }
    updatePurchase(selected.id, (item) => markPurchaseNotRequired(item, notRequiredReason.trim()));
    setNotRequiredReason("");
    setMessage("Compra marcada como not_required con motivo y auditoría demo. Ya no bloquea cierre.");
  }

  return (
    <div className="clients-page">
      <section className="client-kpis">
        <a className="kpi-card" href="#compras-listado"><span className="kpi-icon">🛒</span><span className="kpi-copy"><strong>Compras esperadas</strong><b>{kpis.expected}</b><small>+8 vs. semana anterior ↑</small></span></a>
        <a className="kpi-card" href="#compras-listado"><span className="kpi-icon">!</span><span className="kpi-copy"><strong>Pendientes de conciliar</strong><b>{kpis.pending}</b><small>Requieren revisión</small></span></a>
        <a className="kpi-card" href="#compras-listado"><span className="kpi-icon">⚠</span><span className="kpi-copy"><strong>Con incidencias</strong><b>{kpis.incidents}</b><small>Importe o proveedor no coincide</small></span></a>
        <a className="kpi-card" href="#compras-listado"><span className="kpi-icon">€</span><span className="kpi-copy"><strong>Valor pendiente</strong><b>{formatPurchaseMoney(kpis.pendingValue)}</b><small>A la espera de factura</small></span></a>
      </section>

      <section className="clients-layout">
        <div className="card clients-main" id="compras-listado">
          <div className="client-filters">
            <input className="input" placeholder="Buscar compra o proveedor..." value={search} onChange={(event) => setSearch(event.target.value)} />
            <label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option>Todos</option>{purchaseStatuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>Proveedor<select value={provider} onChange={(event) => setProvider(event.target.value)}>{purchaseProviders.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>Expediente<select value={caseCode} onChange={(event) => setCaseCode(event.target.value)}>{purchaseCaseFilters.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>Prioridad / Match<select value={match} onChange={(event) => setMatch(event.target.value)}>{purchaseMatchFilters.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <button className="btn" type="button" onClick={syncHolded}>↻ Sincronizar Holded</button>
          </div>
          {message ? <p className="client-message">{message}</p> : null}

          <table>
            <thead><tr><th>Compra esperada / referencia</th><th>Proveedor</th><th>Expediente</th><th>Concepto</th><th>Importe esperado</th><th>Estado</th><th>Match Holded</th><th>Responsable</th><th>Última actividad</th><th></th></tr></thead>
            <tbody>{filtered.map((item) => { const candidate = holdedCandidate(item); return <tr key={item.id} className={item.id === selected.id ? "selected-row" : ""}><td><button className="table-link" type="button" onClick={() => setSelectedId(item.id)}><strong>{item.code}</strong></button></td><td>{item.providerName}</td><td><a href={`/expedientes/${item.caseCode}`}>{item.caseCode}</a></td><td>{item.concept}</td><td>{formatPurchaseMoney(item.expectedAmount)}</td><td><span className={`status-pill ${toneClass(purchaseStatusConfig[item.status].tone)}`}>{item.status}</span></td><td>{candidate ? <span>{candidate.holdedDocumentNumber}<br/><small>Candidato {candidate.confidence}%</small></span> : "Sin documento"}</td><td>{item.responsibleName}</td><td>{item.lastActivityAt}</td><td><details><summary className="icon-button">⋮</summary><div className="card" style={{ position: "absolute", right: 24, zIndex: 10 }}><button className="table-link" type="button" onClick={() => setSelectedId(item.id)}>Ver detalle</button><br/><a href={`/expedientes/${item.caseCode}`}>Ver expediente</a><br/><a href="/propuestas">Ver presupuesto</a><br/><button className="table-link" type="button" onClick={() => requestInvoice(item.id)}>Solicitar factura</button><br/><button className="table-link" type="button" onClick={() => approveMatch(item.id)}>Aprobar match</button><br/><button className="table-link" type="button" onClick={() => sendManualReview(item.id)}>Revisar manualmente</button></div></details></td></tr>; })}</tbody>
          </table>
          <div className="table-pagination"><span>Mostrando 1 a {filtered.length} de {items.length} compras</span><span><button className="btn secondary">‹</button><button className="btn">1</button><button className="btn secondary">2</button><button className="btn secondary">3</button><button className="btn secondary">›</button></span></div>
        </div>

        <aside className="client-side card">
          <div className="client-side-header"><div><h2>{selected.code}</h2><p><strong>{selected.providerName}</strong><br/>{selected.caseCode} · {selected.clientName}<br/>{selected.destination}</p></div><span className={`status-pill ${toneClass(purchaseStatusConfig[selected.status].tone)}`}>{selected.status}</span></div>
          <section className="side-section"><h3>Resumen</h3><table><tbody><tr><th>Importe esperado</th><td>{formatPurchaseMoney(selected.expectedAmount)}</td></tr><tr><th>Estado de compra</th><td>{selected.status}</td></tr><tr><th>Responsable</th><td>{selected.responsibleName}</td></tr><tr><th>Prioridad</th><td><span className={`status-pill priority-${selected.priority === "high" ? "high" : selected.priority === "medium" ? "normal" : "low"}`}>{selected.priority}</span></td></tr></tbody></table></section>
          <section className="side-section"><h3>Sugerencia de matching</h3>{selectedCandidate ? <div className="card" style={{ boxShadow: "none" }}><strong>Factura candidata en Holded</strong><p>{selectedCandidate.holdedDocumentNumber}</p><table><tbody><tr><th>Importe</th><td>{formatPurchaseMoney(selectedCandidate.amount)}</td></tr><tr><th>Fecha</th><td>{selectedCandidate.date}</td></tr><tr><th>Confianza</th><td><span className="status-pill status-progress">{selectedCandidate.confidence}%</span></td></tr></tbody></table>{selectedCandidate.checks.map((check) => <p key={check}>✓ {check}</p>)}</div> : <p>No hay documento Holded vinculado todavía.</p>}</section>
          <section className="side-section"><h3>Estado del flujo</h3>{selectedFlow.map((step) => <p key={step.label}><span className={`status-pill ${step.status === "completed" ? "status-progress" : step.status === "in_progress" ? "priority-normal" : ""}`}>{flowLabel(step.status)}</span> <strong>{step.label}</strong></p>)}</section>
          <section className="side-section"><h3>Alertas</h3>{selectedAlerts.length ? selectedAlerts.map((alert) => <p key={alert} className="danger-text">⚠ {alert}</p>) : <p>Sin alertas críticas.</p>}<label>Motivo not_required<textarea className="input" rows={3} value={notRequiredReason} onChange={(event) => setNotRequiredReason(event.target.value)} placeholder="Motivo obligatorio si no se requiere factura" /></label></section>
          <section className="side-actions"><h3>Acciones rápidas</h3><a className="quick-action" href={`/expedientes/${selected.caseCode}`}>Ver expediente <span>→</span></a><button className="quick-action primary" type="button" onClick={() => approveMatch()}>Aprobar match <span>→</span></button><button className="quick-action" type="button" onClick={() => sendManualReview()}>Revisar manualmente <span>→</span></button><a className="quick-action" href={selectedCandidate?.holdedUrl || "#"}>Abrir en Holded <span>→</span></a><button className="quick-action" type="button" onClick={markNotRequired}>Marcar not_required <span>→</span></button></section>
          <div className="client-footnote">Routsify sabe qué facturas faltan y bloquea el cierre si las compras obligatorias no están aprobadas.</div>
        </aside>
      </section>
    </div>
  );
}
