"use client";

import { useState } from "react";
import { DocumentsTab } from "./DocumentsTab";
import { SummaryTab } from "./SummaryTab";
import { TravelersTab } from "./TravelersTab";
import type { WorkspaceProps } from "./workspace-types";
import { formatDateTime, money } from "./workspace-types";

const tabs = [
  ["resumen", "Resumen"],
  ["viajeros", "Viajeros"],
  ["documentos", "Documentos"],
  ["contrato", "Contrato y pagos"],
  ["compras", "Compras"],
  ["actividad", "Actividad"],
] as const;

export function CaseWorkspace(props: WorkspaceProps & { role?: string | null }) {
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("resumen");
  const canAccessSensitive = ["admin", "sales"].includes(String(props.role || ""));

  return <div className="clients-page">
    <nav className="workspace-tabs" aria-label="Secciones del expediente">
      {tabs.map(([value, label]) => <button key={value} className={tab === value ? "active" : ""} type="button" onClick={() => setTab(value)}>{label}</button>)}
    </nav>

    {tab === "resumen" ? <SummaryTab caseRow={props.initialCase} payments={props.initialPayments || []} proposals={props.initialProposals || []} purchases={props.initialPurchases || []} onTab={(value) => setTab(value as (typeof tabs)[number][0])} /> : null}
    {tab === "viajeros" ? <TravelersTab caseId={props.initialCase.id} initialTravelers={props.initialTravelers || []} /> : null}
    {tab === "documentos" ? canAccessSensitive ? <DocumentsTab caseId={props.initialCase.id} caseCode={props.initialCase.case_code} initialDocuments={props.initialDocuments || []} travelers={props.initialTravelers || []} /> : <section className="card"><h2>Acceso restringido</h2><p>La documentación sensible solo está disponible para administración y agentes de ventas.</p></section> : null}
    {tab === "contrato" ? <section className="workspace-grid">
      <div className="card"><h2>Contratos</h2>{(props.initialContracts || []).length ? <div className="table-scroll"><table><thead><tr><th>Contrato</th><th>Estado</th><th>Firma</th></tr></thead><tbody>{(props.initialContracts || []).map((item) => <tr key={item.id}><td>{item.title || "Contrato"}</td><td>{item.status || "draft"}</td><td>{formatDateTime(item.signed_at)}</td></tr>)}</tbody></table></div> : <p>No hay contratos registrados.</p>}<a className="btn secondary" href="/contratos">Gestionar contratos</a></div>
      <div className="card"><h2>Pagos</h2>{(props.initialPayments || []).length ? <div className="table-scroll"><table><thead><tr><th>Referencia</th><th>Importe</th><th>Estado</th></tr></thead><tbody>{(props.initialPayments || []).map((item) => <tr key={item.id}><td>{item.payment_reference || "—"}</td><td>{money(item.amount, item.currency || "EUR")}</td><td>{item.status || "—"}</td></tr>)}</tbody></table></div> : <p>No hay pagos confirmados.</p>}<a className="btn" href={`/propuestas?caseId=${encodeURIComponent(props.initialCase.id)}`}>Gestionar enlace Teya</a></div>
      <div className="card workspace-wide"><h2>Documentos fiscales</h2>{(props.initialFiscal || []).length ? <div className="table-scroll"><table><thead><tr><th>Documento</th><th>Estado</th><th>Importe</th><th>Fecha</th></tr></thead><tbody>{(props.initialFiscal || []).map((item) => <tr key={item.id}><td>{item.document_kind || "documento"} {item.document_number || ""}</td><td>{item.status || "—"}</td><td>{money(item.amount, item.currency || "EUR")}</td><td>{formatDateTime(item.issued_at)}</td></tr>)}</tbody></table></div> : <p>La proforma se generará al confirmar el pago. La factura final quedará bloqueada hasta viaje + 5 días y compras completas.</p>}</div>
    </section> : null}
    {tab === "compras" ? <section className="card"><div className="section-heading"><div><h2>Compras esperadas</h2><p>Cada servicio externo debe quedar conciliado con factura o compra de Holded.</p></div><a className="btn" href={`/compras?caseId=${encodeURIComponent(props.initialCase.id)}`}>Abrir compras</a></div>{(props.initialPurchases || []).length ? <div className="table-scroll"><table><thead><tr><th>Proveedor</th><th>Servicio</th><th>Esperado</th><th>Estado</th></tr></thead><tbody>{(props.initialPurchases || []).map((item) => <tr key={item.id}><td>{item.supplier_name || "Sin proveedor"}</td><td>{item.service || "Servicio"}</td><td>{money(item.expected_amount ?? item.amount)}</td><td>{item.status || "expected"}</td></tr>)}</tbody></table></div> : <p>No hay compras esperadas.</p>}</section> : null}
    {tab === "actividad" ? <section className="workspace-grid"><div className="card"><h2>Tareas</h2>{(props.initialTasks || []).length ? <ul>{(props.initialTasks || []).map((item) => <li key={item.id}><strong>{item.title || "Tarea"}</strong> · {item.status || "pending"}</li>)}</ul> : <p>No hay tareas.</p>}</div><div className="card workspace-wide"><h2>Timeline</h2>{(props.initialTimeline || []).length ? <div className="timeline-list">{(props.initialTimeline || []).map((item) => <article key={item.id}><strong>{item.title || item.event_type || "Evento"}</strong><small>{formatDateTime(item.created_at)}</small></article>)}</div> : <p>No hay actividad registrada.</p>}</div></section> : null}
  </div>;
}
