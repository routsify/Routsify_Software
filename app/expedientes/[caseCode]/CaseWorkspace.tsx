"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { hasPermission } from "@/lib/rbac";
import { ActivityTab } from "./ActivityTab";
import { CasePaymentLinkPanel } from "./CasePaymentLinkPanel";
import { ContractPaymentsTab } from "./ContractPaymentsTab";
import { DocumentsTab } from "./DocumentsTab";
import { LegalDeliveryPanel } from "./LegalDeliveryPanel";
import { SummaryTab } from "./SummaryTab";
import { TravelersTab } from "./TravelersTab";
import type { ContractRow, DocumentRow, FiscalRow, LegalDocumentRow, PaymentRow, PurchaseRow, TaskRow, TimelineRow, Traveler, WorkspaceProps } from "./workspace-types";
import { money, numberValue } from "./workspace-types";

function isIdentityDocument(item: DocumentRow) {
  return ["pasaporte", "passport", "dni", "identity", "identity_document"].includes(String(item.type || item.document_type || "").toLowerCase());
}

function statusLabel(done: boolean, active = false) {
  return <span className={`status-pill ${done ? "status-success" : active ? "status-warning" : ""}`}>{done ? "Completado" : active ? "En curso" : "Pendiente"}</span>;
}

function ProcessStage({ number, id, title, description, done, active, children }: { number: number; id: string; title: string; description: string; done: boolean; active?: boolean; children: ReactNode }) {
  return <section className={`case-process-stage ${done ? "complete" : active ? "active" : ""}`} id={id}><div className="case-process-marker"><span>{done ? "✓" : number}</span><i /></div><div className="case-process-body"><header><div><span className="eyebrow">Paso {number}</span><h2>{title}</h2><p>{description}</p></div>{statusLabel(done, active)}</header>{children}</div></section>;
}

export function CaseWorkspace(props: WorkspaceProps & { role?: string | null }) {
  const role = String(props.role || "viewer");
  const canAccessTravelers = hasPermission(role, "operations.sensitive.view");
  const canAccessSensitive = hasPermission(role, "documents.manage");
  const canAccessContract = hasPermission(role, "operations.sensitive.view");
  const canAccessPurchases = hasPermission(role, "purchases.view");

  const [travelers, setTravelers] = useState<Traveler[]>(props.initialTravelers || []);
  const [documents, setDocuments] = useState<DocumentRow[]>(props.initialDocuments || []);
  const [tasks, setTasks] = useState<TaskRow[]>(props.initialTasks || []);
  const [timeline, setTimeline] = useState<TimelineRow[]>(props.initialTimeline || []);
  const [contracts, setContracts] = useState<ContractRow[]>(props.initialContracts || []);
  const [legalDocuments, setLegalDocuments] = useState<LegalDocumentRow[]>(props.initialLegalDocuments || []);
  const [payments, setPayments] = useState<PaymentRow[]>(props.initialPayments || []);
  const [fiscal, setFiscal] = useState<FiscalRow[]>(props.initialFiscal || []);
  const [purchases, setPurchases] = useState<PurchaseRow[]>(props.initialPurchases || []);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const sections = [
      canAccessTravelers ? "travelers" : null,
      canAccessSensitive ? "documents" : null,
      canAccessContract ? "contract" : null,
      canAccessPurchases ? "purchases" : null,
      "activity",
    ].filter((value): value is string => Boolean(value));
    setLoading(true); setLoadError(null);
    Promise.allSettled(sections.map(async (section) => {
      const response = await fetch(`/api/routsify/cases/${encodeURIComponent(props.initialCase.id)}/workspace?section=${encodeURIComponent(section)}`, { signal: controller.signal, cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(String(result?.error || `No se pudo cargar ${section}.`));
      return result.data || {};
    })).then((results) => {
      if (controller.signal.aborted) return;
      const failures: string[] = [];
      for (const result of results) {
        if (result.status === "rejected") { failures.push(result.reason instanceof Error ? result.reason.message : "Error cargando una sección."); continue; }
        const data = result.value;
        if (Array.isArray(data.travelers)) setTravelers(data.travelers as Traveler[]);
        if (Array.isArray(data.documents)) setDocuments(data.documents as DocumentRow[]);
        if (Array.isArray(data.tasks)) setTasks(data.tasks as TaskRow[]);
        if (Array.isArray(data.timeline)) setTimeline(data.timeline as TimelineRow[]);
        if (Array.isArray(data.contracts)) setContracts(data.contracts as ContractRow[]);
        if (Array.isArray(data.legal_documents)) setLegalDocuments(data.legal_documents as LegalDocumentRow[]);
        if (Array.isArray(data.payments)) setPayments(data.payments as PaymentRow[]);
        if (Array.isArray(data.fiscal_documents)) setFiscal(data.fiscal_documents as FiscalRow[]);
        if (Array.isArray(data.purchases)) setPurchases(data.purchases as PurchaseRow[]);
      }
      if (failures.length) setLoadError([...new Set(failures)].join(" · "));
      setLoading(false);
    });
    return () => controller.abort();
  }, [props.initialCase.id, canAccessTravelers, canAccessSensitive, canAccessContract, canAccessPurchases]);

  const acceptedProposal = props.initialProposals?.find((item) => item.status === "accepted") || props.initialProposals?.[0] || null;
  const precontractAccepted = acceptedProposal?.status === "accepted" || ["proposal_accepted", "documentation_approved", "contract_ready", "contract_signed", "payment_confirmed", "suppliers_pending", "ready_to_close", "closed"].includes(String(props.initialCase.status));
  const identityDocuments = documents.filter(isIdentityDocument);
  const travelersComplete = travelers.length > 0
    && travelers.every((item) => item.review_status === "approved" && item.ocr_status === "approved")
    && identityDocuments.length > 0;
  const signedContract = contracts.some((item) => item.status === "signed");
  const paid = payments.filter((item) => ["confirmed", "paid", "received"].includes(String(item.status))).reduce((sum, item) => sum + numberValue(item.amount), 0);
  const acceptedValue = numberValue(props.initialCase.accepted_value);
  const fullyPaid = acceptedValue > 0 && paid + 0.01 >= acceptedValue;
  const legalSent = timeline.some((item) => item.event_type === "legal_pack.sent");
  const purchasesComplete = purchases.length > 0 && purchases.every((item) => ["approved", "not_required", "cancelled"].includes(String(item.status)));
  const ticketDocuments = documents.filter((item) => ["ticket_cliente", "reserva", "bono_viaje"].includes(String(item.type || item.document_type || "").toLowerCase()));
  const operationComplete = purchasesComplete && ticketDocuments.length > 0;
  const firstPending = [precontractAccepted, travelersComplete, signedContract, fullyPaid, legalSent, operationComplete].findIndex((value) => !value) + 1;
  const steps = useMemo(() => [
    { id: "precontractual", label: "Precontractual", done: precontractAccepted },
    { id: "viajeros-documentos", label: "Viajeros y OCR", done: travelersComplete },
    { id: "contrato", label: "Contrato", done: signedContract },
    { id: "pago", label: "Pago", done: fullyPaid },
    { id: "legales", label: "Documentos legales", done: legalSent },
    { id: "operativa", label: "Compras y tickets", done: operationComplete },
  ], [precontractAccepted, travelersComplete, signedContract, fullyPaid, legalSent, operationComplete]);

  function scrollTo(id: string) { document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  function addPayment(payment: PaymentRow) { setPayments((current) => [payment, ...current.filter((item) => item.id !== payment.id)]); }
  function updateTraveler(traveler: Traveler) { setTravelers((current) => current.map((item) => item.id === traveler.id ? traveler : item)); }

  return <div className="case-process">
    <section className="card case-process-overview"><div><span className="eyebrow">Ruta operativa</span><h2>Del presupuesto aceptado a la entrega del viaje</h2><p>Un único recorrido ordenado. Cada paso conserva su evidencia y desbloquea el siguiente.</p></div><nav aria-label="Progreso del expediente">{steps.map((step, index) => <button key={step.id} type="button" className={step.done ? "complete" : firstPending === index + 1 ? "active" : ""} onClick={() => scrollTo(step.id)}><span>{step.done ? "✓" : index + 1}</span><small>{step.label}</small></button>)}</nav></section>
    {loading ? <p className="client-message" role="status">Cargando el recorrido completo del expediente…</p> : null}
    {loadError ? <section className="card form-warning"><strong>Parte del expediente no se pudo cargar.</strong><p>{loadError}</p></section> : null}

    <ProcessStage number={1} id="precontractual" title="Información precontractual aceptada" description="Resumen inmutable del viaje, servicios, fechas, importes y datos de contacto aceptados por el cliente." done={precontractAccepted} active={firstPending === 1}>
      <SummaryTab caseRow={props.initialCase} payments={payments} proposals={props.initialProposals || []} purchases={purchases} onTab={(target) => scrollTo(target === "contrato" ? "contrato" : target === "compras" ? "operativa" : "precontractual")} />
    </ProcessStage>

    <ProcessStage number={2} id="viajeros-documentos" title="Datos de viajeros y documentación" description="Completa titulares y acompañantes, sube DNI o pasaporte, procesa el OCR y revisa cada dato antes de aprobarlo." done={travelersComplete} active={firstPending === 2}>
      {canAccessTravelers ? <TravelersTab caseId={props.initialCase.id} initialTravelers={travelers} onChange={setTravelers} /> : <section className="card"><h2>Acceso restringido</h2><p>Los datos de viajeros no están disponibles para tu rol.</p></section>}
      {canAccessSensitive ? <DocumentsTab caseId={props.initialCase.id} caseCode={props.initialCase.case_code} initialDocuments={documents} travelers={travelers} onChange={setDocuments} onTravelerChange={updateTraveler} /> : <section className="card"><h2>Acceso restringido</h2><p>La documentación sensible no está disponible para tu rol.</p></section>}
    </ProcessStage>

    <ProcessStage number={3} id="contrato" title="PDF privado y firma del contrato" description="Parte de la información precontractual aceptada, fija los PDFs legales vigentes y registra la evidencia de firma." done={signedContract} active={firstPending === 3}>
      {canAccessContract ? <ContractPaymentsTab mode="contracts" caseRow={props.initialCase} initialContracts={contracts} initialLegalDocuments={legalDocuments} initialPayments={payments} initialFiscal={fiscal} initialProposals={props.initialProposals || []} onContractsChange={setContracts} onPaymentsChange={setPayments} onFiscalChange={setFiscal} /> : <section className="card"><h2>Acceso restringido</h2><p>El contrato no está disponible para tu rol.</p></section>}
    </ProcessStage>

    <ProcessStage number={4} id="pago" title="Enlace de pago y confirmación del cobro" description={`Guarda el enlace Teya por el importe correspondiente y registra el cobro. Cobrado: ${money(paid, props.initialCase.currency || "EUR")} de ${money(acceptedValue, props.initialCase.currency || "EUR")}.`} done={fullyPaid} active={firstPending === 4}>
      <CasePaymentLinkPanel proposalId={acceptedProposal?.id} caseRow={props.initialCase} onPaymentConfirmed={addPayment} />
      {canAccessContract ? <ContractPaymentsTab mode="payments" caseRow={props.initialCase} initialContracts={contracts} initialLegalDocuments={legalDocuments} initialPayments={payments} initialFiscal={fiscal} initialProposals={props.initialProposals || []} onContractsChange={setContracts} onPaymentsChange={setPayments} onFiscalChange={setFiscal} /> : null}
    </ProcessStage>

    <ProcessStage number={5} id="legales" title="Entrega de documentación legal" description="Prepara el correo con contrato firmado, documentación fiscal, condiciones generales e información normalizada; después registra el envío." done={legalSent} active={firstPending === 5}>
      <LegalDeliveryPanel caseRow={props.initialCase} contracts={contracts} legalDocuments={legalDocuments} signed={signedContract} fullyPaid={fullyPaid} sent={legalSent} onSent={(event) => setTimeline((current) => [event, ...current.filter((item) => item.id !== event.id)])} />
    </ProcessStage>

    <ProcessStage number={6} id="operativa" title="Compras de proveedores y entrega de tickets" description="Concilia cada compra y sube bonos, reservas y tickets que quedarán disponibles para el cliente." done={operationComplete} active={firstPending === 6}>
      {canAccessPurchases ? <section className="card"><div className="section-heading"><div><h2>Compras esperadas</h2><p>Cada servicio externo debe quedar conciliado con factura o compra de Holded.</p></div><a className="btn" href={`/compras?caseId=${encodeURIComponent(props.initialCase.id)}`}>Abrir compras</a></div>{purchases.length ? <div className="table-scroll"><table><thead><tr><th>Proveedor</th><th>Servicio</th><th>Esperado</th><th>Estado</th></tr></thead><tbody>{purchases.map((item) => <tr key={item.id}><td>{item.supplier_name || "Sin proveedor"}</td><td>{item.service || "Servicio"}</td><td>{money(item.expected_amount || item.amount, props.initialCase.currency || "EUR")}</td><td>{item.status || "pending"}</td></tr>)}</tbody></table></div> : <p>No hay compras esperadas.</p>}</section> : <section className="card"><h2>Acceso restringido</h2><p>Las compras no están disponibles para tu rol.</p></section>}
      <section className="card"><div className="panel-head"><div><h2>Tickets y bonos del cliente</h2><p>Sube los documentos desde el paso de documentación usando el tipo “Ticket / bono de viaje”.</p></div><span className="badge">{ticketDocuments.length}</span></div><button className="btn secondary" type="button" onClick={() => scrollTo("viajeros-documentos")}>Ir a documentación</button></section>
    </ProcessStage>

    <section className="case-process-activity" id="actividad"><ActivityTab caseId={props.initialCase.id} initialTasks={tasks} timeline={timeline} /></section>
  </div>;
}
