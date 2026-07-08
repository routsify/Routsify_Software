"use client";

import { useMemo, useState } from "react";
import { cases, expectedPurchases } from "@/lib/mock-data";
import { buildCloseChecks, closeSummary } from "@/lib/close";
import { demoTravelers, travelerSummary } from "@/lib/travelers";
import { demoContracts } from "@/lib/contracts";
import { demoPayments, demoBillingDocuments, formatBillingMoney } from "@/lib/billing";
import { demoDocuments } from "@/lib/documents";
import { isDemoMode } from "@/lib/supabase-browser";

function closedPurchase(status: string) {
  return status === "approved" || status === "not_required" || status === "cancelled";
}

export function CloseManager() {
  const [caseCode, setCaseCode] = useState(cases[0]?.case_code ?? "");
  const [finalNotesSaved, setFinalNotesSaved] = useState(false);
  const currentCase = cases.find((item) => item.case_code === caseCode) || cases[0];

  const checks = useMemo(() => {
    const travelers = demoTravelers.filter((item) => item.case_code === currentCase.case_code);
    const contracts = demoContracts.filter((item) => item.case_code === currentCase.case_code);
    const payments = demoPayments.filter((item) => item.case_code === currentCase.case_code);
    const purchases = expectedPurchases.filter((item) => item.case_code === currentCase.case_code);
    const files = demoDocuments.filter((item) => item.case_code === currentCase.case_code);
    const fiscalDocs = demoBillingDocuments.filter((item) => item.case_code === currentCase.case_code);
    const travelerStats = travelerSummary(travelers);
    const received = payments.filter((item) => item.status === "received").reduce((sum, item) => sum + item.amount, 0);
    const sale = currentCase.accepted_value || 0;
    const paymentOutstanding = sale > 0 ? Math.max(sale - received, 0) : 1;

    return buildCloseChecks({
      proposalAccepted: currentCase.accepted_value > 0 || currentCase.status === "proposal_accepted" || currentCase.status === "payment_confirmed" || currentCase.status === "ready_to_close" || currentCase.status === "closed",
      travelersReady: travelerStats.ready,
      contractSigned: contracts.some((item) => item.status === "signed"),
      paymentOutstanding,
      supplierPending: purchases.filter((item) => !closedPurchase(item.status)).length,
      fiscalBlocked: fiscalDocs.filter((item) => item.status === "blocked" || item.status === "error" || item.status === "draft").length,
      documentsPending: files.filter((item) => item.status === "missing" || item.status === "expired" || item.status === "reviewing" || item.status === "rejected").length,
      finalNotesSaved,
    });
  }, [currentCase, finalNotesSaved]);

  const summary = useMemo(() => closeSummary(checks), [checks]);
  const next = summary.nextAction;

  return (
    <div className="grid">
      <section className="card">
        <div className="header" style={{ marginBottom: 0 }}>
          <div><div className="eyebrow">Expediente</div><h2>{currentCase.case_code} · {currentCase.client}</h2><p>{currentCase.title}</p></div>
          <select value={caseCode} onChange={(event) => setCaseCode(event.target.value)}>{cases.map((item) => <option key={item.case_code} value={item.case_code}>{item.case_code} · {item.client}</option>)}</select>
        </div>
      </section>

      <section className="grid grid-3">
        <div className="card"><span className="badge">Progreso</span><div className="metric">{summary.progress}%</div><p>{summary.done}/{summary.total} controles completados.</p></div>
        <div className="card"><span className="badge">Bloqueos</span><div className="metric">{summary.blockingOpen}</div><p>{summary.informativeOpen} controles informativos pendientes.</p></div>
        <div className="card"><span className="badge">Estado sugerido</span><div className="metric">{summary.status}</div><p>{isDemoMode() ? "Modo demo" : "Supabase real"}</p></div>
      </section>

      <section className="grid grid-2">
        <div className="card"><div className="eyebrow">Siguiente acción</div><h2>{next ? next.label : "Listo para cierre"}</h2><p>{next ? next.action : "Registrar cierre y revisar regularización final."}</p>{next ? <a className="btn secondary" href={next.href}>Abrir {next.area}</a> : <a className="btn" href={`/expedientes/${currentCase.case_code}`}>Ver expediente</a>}</div>
        <div className="card"><div className="eyebrow">Notas finales</div><h2>Aprendizaje operativo</h2><p>Registrar incidencias, cambios, proveedores problemáticos y decisiones finales.</p><label style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" checked={finalNotesSaved} onChange={(event) => setFinalNotesSaved(event.target.checked)} />Notas finales guardadas</label></div>
      </section>

      <section className="card">
        <div className="header" style={{ marginBottom: 0 }}><div><div className="eyebrow">Checklist de cierre</div><h2>Controles calculados desde la operativa</h2><p>Se alimenta de propuesta, viajeros, documentos, contrato, pagos y compras.</p></div><a className="btn secondary" href={`/expedientes/${currentCase.case_code}`}>Ver expediente 360</a></div>
        <table><thead><tr><th>Estado</th><th>Control</th><th>Evidencia</th><th>Tipo</th><th>Acción</th></tr></thead><tbody>{checks.map((check) => <tr key={check.id}><td><span className="badge">{check.done ? "ok" : "pendiente"}</span></td><td><strong>{check.label}</strong><br/><small>{check.description}</small></td><td>{check.evidence}</td><td><span className="badge">{check.blocking ? "bloqueante" : "informativo"}</span></td><td><a href={check.href}>{check.area}</a><br/><small>{check.action}</small></td></tr>)}</tbody></table>
      </section>

      <section className="grid grid-2">
        <div className="card"><div className="eyebrow">Decisión</div><h2>{summary.status === "ready_to_close" ? "Listo para cierre operativo" : "No cerrar todavía"}</h2><p>{summary.status === "ready_to_close" ? "No quedan bloqueos críticos." : "Todavía hay bloqueos críticos. Trabaja la siguiente acción sugerida."}</p></div>
        <div className="card"><div className="eyebrow">Valor aceptado</div><h2>{formatBillingMoney(currentCase.accepted_value || 0, currentCase.currency)}</h2><p>Se compara contra cobros, contrato, compras y documentos.</p></div>
      </section>
    </div>
  );
}
