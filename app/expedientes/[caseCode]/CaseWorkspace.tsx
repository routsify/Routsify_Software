"use client";

import { useEffect, useState } from "react";
import { ActivityTab } from "./ActivityTab";
import { ContractPaymentsTab } from "./ContractPaymentsTab";
import { DocumentsTab } from "./DocumentsTab";
import { SummaryTab } from "./SummaryTab";
import { TravelersTab } from "./TravelersTab";
import type { ContractRow, DocumentRow, FiscalRow, PaymentRow, PurchaseRow, TaskRow, TimelineRow, Traveler, WorkspaceProps } from "./workspace-types";
import { money } from "./workspace-types";

const tabs = [["resumen", "Resumen"], ["viajeros", "Viajeros"], ["documentos", "Documentos"], ["contrato", "Contrato y pagos"], ["compras", "Compras"], ["actividad", "Actividad"]] as const;
type WorkspaceTab = (typeof tabs)[number][0];

export function CaseWorkspace(props: WorkspaceProps & { role?: string | null }) {
  const role = String(props.role || "");
  const canAccessTravelers = ["admin", "direction", "sales", "operations"].includes(role);
  const canAccessSensitive = ["admin", "sales"].includes(role);
  const canAccessContract = ["admin", "direction", "sales", "operations", "billing"].includes(role);
  const canAccessPurchases = ["admin", "direction", "sales", "operations", "billing"].includes(role);

  const [tab, setTab] = useState<WorkspaceTab>("resumen");
  const [loadedTabs, setLoadedTabs] = useState<Set<WorkspaceTab>>(() => new Set<WorkspaceTab>(["resumen", ...(canAccessPurchases ? ["compras" as WorkspaceTab] : [])]));
  const [travelers, setTravelers] = useState<Traveler[]>(props.initialTravelers || []);
  const [documents, setDocuments] = useState<DocumentRow[]>(props.initialDocuments || []);
  const [tasks, setTasks] = useState<TaskRow[]>(props.initialTasks || []);
  const [timeline, setTimeline] = useState<TimelineRow[]>(props.initialTimeline || []);
  const [contracts, setContracts] = useState<ContractRow[]>(props.initialContracts || []);
  const [payments, setPayments] = useState<PaymentRow[]>(props.initialPayments || []);
  const [fiscal, setFiscal] = useState<FiscalRow[]>(props.initialFiscal || []);
  const [purchases, setPurchases] = useState<PurchaseRow[]>(props.initialPurchases || []);
  const [loading, setLoading] = useState<WorkspaceTab | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (loadedTabs.has(tab)) return;
    if (tab === "viajeros" && !canAccessTravelers) return;
    if (tab === "documentos" && !canAccessSensitive) return;
    if (tab === "contrato" && !canAccessContract) return;
    if (tab === "compras" && !canAccessPurchases) return;

    const controller = new AbortController();
    setLoading(tab);
    setLoadError(null);
    const section = tab === "contrato" ? "contract" : tab === "compras" ? "purchases" : tab === "actividad" ? "activity" : tab;
    fetch(`/api/routsify/cases/${encodeURIComponent(props.initialCase.id)}/workspace?section=${encodeURIComponent(section)}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.ok) throw new Error(String(result?.error || "No se pudo cargar esta sección."));
        const data = result.data || {};
        if (Array.isArray(data.travelers)) setTravelers(data.travelers as Traveler[]);
        if (Array.isArray(data.documents)) setDocuments(data.documents as DocumentRow[]);
        if (Array.isArray(data.tasks)) setTasks(data.tasks as TaskRow[]);
        if (Array.isArray(data.timeline)) setTimeline(data.timeline as TimelineRow[]);
        if (Array.isArray(data.contracts)) setContracts(data.contracts as ContractRow[]);
        if (Array.isArray(data.payments)) setPayments(data.payments as PaymentRow[]);
        if (Array.isArray(data.fiscal_documents)) setFiscal(data.fiscal_documents as FiscalRow[]);
        if (Array.isArray(data.purchases)) setPurchases(data.purchases as PurchaseRow[]);
        setLoadedTabs((current) => {
          const next = new Set(current);
          next.add(tab);
          return next;
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : "No se pudo cargar esta sección.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(null);
      });

    return () => controller.abort();
  }, [tab, loadedTabs, props.initialCase.id, canAccessTravelers, canAccessSensitive, canAccessContract, canAccessPurchases]);

  const restricted = (message: string) => <section className="card"><h2>Acceso restringido</h2><p>{message}</p></section>;
  const loadingPanel = loading === tab ? <section className="card"><h2>Cargando sección…</h2><p>Recuperando únicamente los datos necesarios.</p></section> : null;
  const errorPanel = loadError ? <section className="card form-warning"><strong>No se pudo cargar la sección.</strong><p>{loadError}</p></section> : null;

  return <div className="clients-page">
    <nav className="workspace-tabs" aria-label="Secciones del expediente">{tabs.map(([value, label]) => <button key={value} className={tab === value ? "active" : ""} type="button" onClick={() => { setLoadError(null); setTab(value); }}>{label}</button>)}</nav>
    {errorPanel}
    {loadingPanel}

    <div hidden={tab !== "resumen"}><SummaryTab caseRow={props.initialCase} payments={props.initialPayments || []} proposals={props.initialProposals || []} purchases={props.initialPurchases || []} onTab={(value) => setTab(value as WorkspaceTab)} /></div>

    {canAccessTravelers ? loadedTabs.has("viajeros") ? <div hidden={tab !== "viajeros"}><TravelersTab caseId={props.initialCase.id} initialTravelers={travelers} /></div> : null : tab === "viajeros" ? restricted("Los datos de viajeros solo están disponibles para administración, dirección, ventas y operaciones.") : null}

    {canAccessSensitive ? loadedTabs.has("documentos") ? <div hidden={tab !== "documentos"}><DocumentsTab caseId={props.initialCase.id} caseCode={props.initialCase.case_code} initialDocuments={documents} travelers={travelers} /></div> : null : tab === "documentos" ? restricted("La documentación sensible solo está disponible para administración y agentes de ventas.") : null}

    {canAccessContract ? loadedTabs.has("contrato") ? <div hidden={tab !== "contrato"}><ContractPaymentsTab caseRow={props.initialCase} initialContracts={contracts} initialPayments={payments} initialFiscal={fiscal} /></div> : null : tab === "contrato" ? restricted("Esta sección no está disponible para tu rol.") : null}

    {canAccessPurchases ? loadedTabs.has("compras") ? <div hidden={tab !== "compras"}><section className="card"><div className="section-heading"><div><h2>Compras esperadas</h2><p>Cada servicio externo debe quedar conciliado con factura o compra de Holded.</p></div><a className="btn" href={`/compras?caseId=${encodeURIComponent(props.initialCase.id)}`}>Abrir compras</a></div>{purchases.length ? <div className="table-scroll"><table><thead><tr><th>Proveedor</th><th>Servicio</th><th>Esperado</th><th>Estado</th></tr></thead><tbody>{purchases.map((item) => <tr key={item.id}><td>{item.supplier_name || "Sin proveedor"}</td><td>{item.service || "Servicio"}</td><td>{money(item.expected_amount ?? item.amount)}</td><td>{item.status || "expected"}</td></tr>)}</tbody></table></div> : <p>No hay compras esperadas.</p>}</section></div> : null : tab === "compras" ? restricted("Esta sección no está disponible para tu rol.") : null}

    {loadedTabs.has("actividad") ? <div hidden={tab !== "actividad"}><ActivityTab caseId={props.initialCase.id} initialTasks={tasks} timeline={timeline} /></div> : null}
  </div>;
}
