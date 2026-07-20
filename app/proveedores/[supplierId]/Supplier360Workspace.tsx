"use client";

import { useMemo, useState } from "react";
import type { Supplier360Data } from "@/lib/supplier-360-server";
import { SupplierIncidentsPanel } from "./SupplierIncidentsPanel";
import { SupplierProfilePanel } from "./SupplierProfilePanel";
import { SupplierServicesPanel } from "./SupplierServicesPanel";

type Row = Record<string, unknown>;
type Tab = "resumen" | "economia" | "actividad";

function text(value: unknown) { return String(value ?? "").trim(); }
function numberValue(value: unknown) { const parsed = Number(value || 0); return Number.isFinite(parsed) ? parsed : 0; }
function relation(value: unknown): Row | null { if (Array.isArray(value)) return value[0] && typeof value[0] === "object" ? value[0] as Row : null; return value && typeof value === "object" ? value as Row : null; }
function money(value: unknown, currency = "EUR") { return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(numberValue(value)); }
function dateTime(value: unknown) { const raw = text(value); if (!raw) return "—"; const date = new Date(raw); return Number.isNaN(date.getTime()) ? raw : date.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }); }
function initials(value: unknown) { return text(value).split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "PR"; }

export function Supplier360Workspace({ initialData }: { initialData: Supplier360Data }) {
  const [supplier, setSupplier] = useState<Row>(initialData.supplier);
  const [tab, setTab] = useState<Tab>("resumen");
  const supplierId = text(supplier.id);
  const activeServices = initialData.services.filter((item) => item.active !== false);
  const openIncidents = initialData.incidents.filter((item) => text(item.status) !== "resolved");
  const pendingPurchases = initialData.purchases.filter((item) => !["approved", "not_required", "cancelled"].includes(text(item.status)));
  const expectedCost = initialData.purchases.reduce((sum, item) => sum + numberValue(item.expected_amount), 0);
  const approvedCost = initialData.purchases.reduce((sum, item) => sum + numberValue(item.approved_cost || item.invoice_total), 0);
  const invoicedTotal = initialData.invoices.reduce((sum, item) => sum + numberValue(item.total_amount || item.total), 0);
  const deviation = approvedCost - expectedCost;
  const cases = useMemo(() => {
    const result = new Map<string, string>();
    for (const purchase of initialData.purchases) {
      const caseId = text(purchase.case_id);
      const caseRow = relation(purchase.cases);
      if (caseId) result.set(caseId, [text(caseRow?.case_code), text(caseRow?.destination)].filter(Boolean).join(" · ") || caseId);
    }
    return [...result.entries()].map(([id, label]) => ({ id, label }));
  }, [initialData.purchases]);

  const email = text(supplier.email);
  const phone = text(supplier.phone).replace(/\D/g, "");
  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: "resumen", label: "Resumen" },
    { id: "economia", label: "Compras y facturas", count: initialData.purchases.length },
    { id: "actividad", label: "Documentos y comunicaciones", count: initialData.documents.length + initialData.communications.length },
  ];

  return <div className="supplier360">
    <section className="card supplier360-hero">
      <div className="supplier360-identity"><span className="client-avatar">{initials(supplier.name)}</span><div><div className="eyebrow">Ficha interna</div><h2>{text(supplier.name)}</h2><p>{text(supplier.category) || "Sin categoría"} · {text(supplier.country) || "Sin país"}</p><div className="client-badges"><span className="badge">{supplier.preferred ? "Preferente" : "Proveedor"}</span><span className="badge">Fiabilidad {numberValue(supplier.reliability_score)}/100</span><span className="badge">{supplier.holded_contact_id ? "Holded vinculado" : "Holded pendiente"}</span></div></div></div>
      <div className="supplier360-actions">{email ? <a className="btn secondary" href={`mailto:${encodeURIComponent(email)}`}>Email</a> : null}{phone ? <a className="btn secondary" href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer">WhatsApp</a> : null}<a className="btn secondary" href={`/compras?supplierId=${encodeURIComponent(supplierId)}`}>Abrir compras</a><a className="btn" href="/proveedores">Volver</a></div>
    </section>

    <section className="client-kpis">
      <div className="kpi-card"><span className="kpi-icon">F</span><span className="kpi-copy"><strong>Fiabilidad</strong><b>{numberValue(supplier.reliability_score)}</b><small>Riesgo {text(supplier.risk_level) || "low"}</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">S</span><span className="kpi-copy"><strong>Servicios activos</strong><b>{activeServices.length}</b><small>{initialData.services.length} registrados</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">!</span><span className="kpi-copy"><strong>Incidencias abiertas</strong><b>{openIncidents.length}</b><small>{pendingPurchases.length} compras pendientes</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">€</span><span className="kpi-copy"><strong>Coste aprobado</strong><b>{money(approvedCost, text(supplier.default_currency) || "EUR")}</b><small>Desviación {money(deviation, text(supplier.default_currency) || "EUR")}</small></span></div>
    </section>

    <nav className="client360-tabs" aria-label="Secciones del proveedor">{tabs.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} type="button" onClick={() => setTab(item.id)}>{item.label}{item.count !== undefined ? <span>{item.count}</span> : null}</button>)}</nav>

    {tab === "resumen" ? <div className="supplier360-grid">
      <SupplierProfilePanel supplier={supplier} onSaved={setSupplier} />
      <section className="card supplier360-card"><div className="panel-head"><div><h2>Contacto y fiscalidad</h2><p>Datos maestros sincronizables con Holded.</p></div></div><dl className="client360-dl"><div><dt>Email</dt><dd>{email || "—"}</dd></div><div><dt>Teléfono</dt><dd>{text(supplier.phone) || "—"}</dd></div><div><dt>NIF / ID fiscal</dt><dd>{text(supplier.tax_id) || "Pendiente"}</dd></div><div><dt>País</dt><dd>{text(supplier.country) || "—"}</dd></div><div><dt>Moneda</dt><dd>{text(supplier.default_currency) || "EUR"}</dd></div><div><dt>Holded</dt><dd>{supplier.holded_contact_id ? "Vinculado" : "Pendiente"}</dd></div></dl><div className="client360-note"><strong>Notas internas</strong><p>{text(supplier.notes) || "Sin notas."}</p></div></section>
      <SupplierServicesPanel supplierId={supplierId} initialServices={initialData.services} />
      <SupplierIncidentsPanel supplierId={supplierId} initialIncidents={initialData.incidents} cases={cases} />
    </div> : null}

    {tab === "economia" ? <div className="supplier360-grid">
      <section className="card supplier360-card"><div className="panel-head"><div><h2>Resumen económico</h2><p>Comparación de coste previsto, aprobado y facturado.</p></div></div><dl className="client360-dl client360-dl-economic"><div><dt>Coste previsto</dt><dd>{money(expectedCost)}</dd></div><div><dt>Coste aprobado</dt><dd>{money(approvedCost)}</dd></div><div><dt>Facturado</dt><dd>{money(invoicedTotal)}</dd></div><div><dt>Desviación</dt><dd className={deviation > 0 ? "danger-text" : ""}>{money(deviation)}</dd></div><div><dt>Compras</dt><dd>{initialData.purchases.length}</dd></div><div><dt>Pendientes</dt><dd>{pendingPurchases.length}</dd></div></dl></section>
      <section className="card supplier360-card"><div className="panel-head"><div><h2>Estado contable</h2><p>Holded conserva la fuente fiscal; aquí se controla la conciliación operativa.</p></div></div><dl className="client360-dl"><div><dt>Facturas registradas</dt><dd>{initialData.invoices.length}</dd></div><div><dt>Con ID Holded</dt><dd>{initialData.invoices.filter((item) => item.holded_purchase_id).length}</dd></div><div><dt>Aprobadas</dt><dd>{initialData.invoices.filter((item) => ["approved", "done"].includes(text(item.status))).length}</dd></div><div><dt>Pendientes de revisión</dt><dd>{initialData.invoices.filter((item) => !["approved", "done"].includes(text(item.status))).length}</dd></div></dl></section>
      <section className="card supplier360-card supplier360-full"><div className="panel-head"><div><h2>Compras vinculadas</h2><p>Servicios contratados por expediente.</p></div><a className="btn secondary" href={`/compras?supplierId=${encodeURIComponent(supplierId)}`}>Gestionar compras</a></div>{initialData.purchases.length === 0 ? <div className="empty-state"><h3>Sin compras</h3><p>No hay compras vinculadas.</p></div> : <div className="table-scroll"><table><thead><tr><th>Expediente</th><th>Servicio</th><th>Previsto</th><th>Real</th><th>Factura</th><th>Estado</th></tr></thead><tbody>{initialData.purchases.map((purchase) => { const caseRow = relation(purchase.cases); const currency = text(purchase.currency || caseRow?.currency) || "EUR"; return <tr key={text(purchase.id)}><td><strong>{text(caseRow?.case_code) || "—"}</strong><br /><small>{text(caseRow?.destination)}</small></td><td>{text(purchase.service) || "Servicio"}</td><td>{money(purchase.expected_amount, currency)}</td><td>{money(purchase.approved_cost || purchase.invoice_total, currency)}</td><td>{text(purchase.invoice_number) || "Pendiente"}</td><td>{text(purchase.status) || "—"}</td></tr>; })}</tbody></table></div>}</section>
      <section className="card supplier360-card supplier360-full"><div className="panel-head"><div><h2>Facturas</h2><p>Documentos de proveedor y estado de sincronización.</p></div></div>{initialData.invoices.length === 0 ? <div className="empty-state"><h3>Sin facturas</h3><p>No hay facturas registradas.</p></div> : <div className="table-scroll"><table><thead><tr><th>Factura</th><th>Fecha</th><th>Total</th><th>Estado</th><th>Holded</th></tr></thead><tbody>{initialData.invoices.map((invoice) => <tr key={text(invoice.id)}><td><strong>{text(invoice.invoice_number) || text(invoice.file_name) || "Factura"}</strong></td><td>{dateTime(invoice.invoice_date || invoice.uploaded_at || invoice.created_at)}</td><td>{money(invoice.total_amount || invoice.total, text(invoice.currency) || "EUR")}</td><td>{text(invoice.status || invoice.sync_status) || "—"}</td><td>{invoice.holded_purchase_id ? "Vinculada" : "Pendiente"}</td></tr>)}</tbody></table></div>}</section>
    </div> : null}

    {tab === "actividad" ? <div className="supplier360-grid">
      <section className="card supplier360-card"><div className="panel-head"><div><h2>Documentos internos</h2><p>Contratos, tarifas y archivos asociados al proveedor.</p></div><span className="badge">{initialData.documents.length}</span></div>{initialData.documents.length === 0 ? <div className="empty-state"><h3>Sin documentos</h3><p>No hay archivos internos vinculados.</p></div> : <div className="supplier360-list">{initialData.documents.map((document) => <article key={text(document.id)}><div><strong>{text(document.title || document.file_name) || "Documento"}</strong><small>{text(document.document_type || document.type)} · {dateTime(document.created_at)}</small></div><span className="status-pill">{text(document.status) || "registrado"}</span></article>)}</div>}</section>
      <section className="card supplier360-card"><div className="panel-head"><div><h2>Comunicaciones</h2><p>Confirmaciones y solicitudes de factura.</p></div><span className="badge">{initialData.communications.length}</span></div>{initialData.communications.length === 0 ? <div className="empty-state"><h3>Sin comunicaciones</h3><p>Las comunicaciones aparecerán aquí.</p></div> : <div className="supplier360-list">{initialData.communications.map((item) => <article key={text(item.id)}><div><strong>{text(item.subject || item.kind) || "Comunicación"}</strong><small>{text(item.channel)} · {dateTime(item.sent_at || item.created_at)}</small></div><span className={`status-pill ${item.failed_at ? "status-danger" : item.answered_at ? "status-done" : "status-pending"}`}>{item.failed_at ? "Fallida" : item.answered_at ? "Respondida" : text(item.provider_status || item.status) || "Pendiente"}</span></article>)}</div>}</section>
    </div> : null}
  </div>;
}
