"use client";

import { FormEvent, useMemo, useState } from "react";
import { expectedPurchases as demoPurchases } from "@/lib/mock-data";
import { bestHoldedCandidate, matchAction } from "@/lib/demo-holded-matching";
import { formatMoney, invoiceDelta, needsReview, PurchaseItem, purchaseStatuses, purchaseTotals } from "@/lib/purchases";
import { isDemoMode } from "@/lib/supabase-browser";

function toPurchaseItems(): PurchaseItem[] {
  return demoPurchases.map((item, index) => ({
    id: `purchase-${index + 1}`,
    case_code: item.case_code,
    supplier: item.supplier,
    service: item.service,
    status: item.status as PurchaseItem["status"],
    amount: item.amount,
    currency: "EUR",
  }));
}

export function PurchasesManager() {
  const [items, setItems] = useState<PurchaseItem[]>(toPurchaseItems());
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [base, setBase] = useState("");
  const [tax, setTax] = useState("");
  const [total, setTotal] = useState("");
  const [fileName, setFileName] = useState("");
  const [notRequiredReason, setNotRequiredReason] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const totals = useMemo(() => purchaseTotals(items), [items]);
  const selected = items.find((item) => item.id === selectedId);

  function updateStatus(id: string, status: PurchaseItem["status"]) {
    setItems((current) => current.map((item) => {
      if (item.id !== id) return item;
      const next: PurchaseItem = { ...item, status };
      if (status === "not_required" && !item.not_required_reason) next.not_required_reason = "Motivo pendiente de completar";
      return next;
    }));
  }

  function approveBestMatch(id: string) {
    const current = items.find((item) => item.id === id);
    if (!current) return;
    const candidate = bestHoldedCandidate(current);
    if (!candidate) {
      setMessage("No hay candidato Holded. Reclama la factura al proveedor.");
      return;
    }
    const status: PurchaseItem["status"] = candidate.confidence === "alta" ? "matched" : "review_needed";
    setItems((list) => list.map((item) => item.id === id ? {
      ...item,
      status,
      invoice_number: candidate.id,
      invoice_date: candidate.date,
      invoice_total: candidate.amount,
      invoice_file: `${candidate.id}.pdf`,
      review_notes: `${candidate.confidence}: ${candidate.reasons.join(" · ")}`,
    } : item));
    setMessage(candidate.confidence === "alta" ? "Match Holded aprobado en demo. Revisa y cambia a approved cuando proceda." : "Match dudoso. Queda en revisión manual.");
  }

  function attachInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const current = items.find((item) => item.id === selectedId);
    if (!current) return;

    const invoiceTotal = Number(total) || current.amount;
    const fallbackFileName = `${current.case_code}-${current.supplier}`.replace(/\s+/g, "_") + ".pdf";
    const delta = Math.abs(invoiceTotal - current.amount);
    const status: PurchaseItem["status"] = delta > 1 ? "review_needed" : "uploaded";

    setItems((list) => list.map((item) => item.id === selectedId ? {
      ...item,
      status,
      invoice_file: fileName.trim() || fallbackFileName,
      invoice_number: invoiceNumber.trim() || undefined,
      invoice_date: invoiceDate || undefined,
      invoice_base: Number(base) || undefined,
      invoice_tax: Number(tax) || undefined,
      invoice_total: invoiceTotal,
      currency: "EUR",
      review_notes: notes.trim() || (delta > 1 ? "Diferencia entre importe previsto y factura recibida." : undefined),
    } : item));
    setInvoiceNumber("");
    setInvoiceDate("");
    setBase("");
    setTax("");
    setTotal("");
    setFileName("");
    setNotes("");
    setMessage(isDemoMode() ? "Factura registrada en modo demo. Si hay diferencia de importe, queda en revisión antes de aprobar." : "Factura vinculada a la compra esperada.");
  }

  function markNotRequired(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const current = items.find((item) => item.id === selectedId);
    if (!current) return;
    if (!notRequiredReason.trim()) {
      setMessage("Para marcar una compra como no requerida hace falta motivo obligatorio.");
      return;
    }
    setItems((list) => list.map((item) => item.id === selectedId ? { ...item, status: "not_required", not_required_reason: notRequiredReason.trim() } : item));
    setNotRequiredReason("");
    setMessage("Compra marcada como no requerida con motivo. En real quedará auditado.");
  }

  return (
    <div className="grid">
      <section className="grid grid-3">
        <div className="card"><span className="badge">Compras esperadas</span><div className="metric">{totals.count}</div><p>Líneas de presupuesto que generan factura proveedor.</p></div>
        <div className="card"><span className="badge">Pendiente de cerrar</span><div className="metric">{formatMoney(totals.pendingAmount)}</div><p>{totals.pendingCount} compras no aprobadas/no justificadas.</p></div>
        <div className="card"><span className="badge">Revisión necesaria</span><div className="metric">{totals.reviewNeededCount}</div><p>Diferencias de importe, proveedor, fecha o evidencia.</p></div>
      </section>

      <section className="grid grid-2">
        <div className="card">
          <div className="eyebrow">Subida manual</div>
          <h2>Registrar factura proveedor</h2>
          <form className="form" onSubmit={attachInvoice}>
            <label>Compra esperada<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{items.map((item) => <option key={item.id} value={item.id}>{item.case_code} · {item.supplier} · {formatMoney(item.amount)}</option>)}</select></label>
            <div className="grid grid-2"><label>Número de factura<input className="input" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="FAC-2026-0001" /></label><label>Fecha factura<input className="input" type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} /></label></div>
            <div className="grid grid-3"><label>Base<input className="input" type="number" step="0.01" value={base} onChange={(event) => setBase(event.target.value)} /></label><label>Impuestos<input className="input" type="number" step="0.01" value={tax} onChange={(event) => setTax(event.target.value)} /></label><label>Total<input className="input" type="number" step="0.01" value={total} onChange={(event) => setTotal(event.target.value)} placeholder={selected ? String(selected.amount) : "0"} /></label></div>
            <label>Nombre de archivo<input className="input" value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder="factura-proveedor.pdf" /></label>
            <label>Notas de revisión<textarea className="input" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Diferencia con presupuesto, IVA, vencimiento, etc." /></label>
            {message ? <p>{message}</p> : null}
            <button className="btn" type="submit">Registrar factura</button>
          </form>
        </div>

        <div className="card">
          <div className="eyebrow">Matching Holded demo</div>
          <h2>Candidatos y excepción</h2>
          <p>Routsify propone matches por EXP_CODE, budget_line_id, proveedor, importe, fecha y destino. Los matches dudosos quedan en revisión manual.</p>
          <form className="form" onSubmit={markNotRequired}>
            <label>Compra esperada<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{items.map((item) => <option key={item.id} value={item.id}>{item.case_code} · {item.supplier}</option>)}</select></label>
            <label>Motivo obligatorio<textarea className="input" rows={3} value={notRequiredReason} onChange={(event) => setNotRequiredReason(event.target.value)} placeholder="Ej. servicio cancelado, coste incluido en otro proveedor, no procede factura separada..." /></label>
            <button className="btn secondary" type="submit">Marcar no requerida</button>
          </form>
          <table><tbody><tr><th>Aprobadas</th><td>{totals.approvedCount}/{totals.count}</td></tr><tr><th>Cerradas o justificadas</th><td>{totals.closedCount}/{totals.count}</td></tr><tr><th>Modo actual</th><td>{isDemoMode() ? "Demo" : "Supabase"}</td></tr><tr><th>Cierre recomendado</th><td><span className="badge">{totals.pendingCount === 0 ? "ready_to_close" : "suppliers_pending"}</span></td></tr></tbody></table>
        </div>
      </section>

      <section className="card">
        <table>
          <thead><tr><th>Expediente</th><th>Proveedor</th><th>Servicio</th><th>Estado</th><th>Previsto</th><th>Holded candidato</th><th>Diferencia</th><th>Acción</th></tr></thead>
          <tbody>{items.map((item) => { const candidate = bestHoldedCandidate(item); return <tr key={item.id}><td><a href={`/expedientes/${item.case_code}`}><strong>{item.case_code}</strong></a></td><td>{item.supplier}</td><td>{item.service}</td><td><span className="badge">{item.status}</span></td><td>{formatMoney(item.amount, item.currency)}</td><td>{candidate ? <span>{candidate.id} · {candidate.confidence}<br/><small>{candidate.supplier} · {formatMoney(candidate.amount)} · {candidate.reasons.join(" · ")}</small></span> : "Sin candidato"}</td><td>{item.invoice_total ? <span>{formatMoney(invoiceDelta(item), item.currency)}{needsReview(item) ? <><br/><small>revisar</small></> : null}</span> : candidate ? <span>{formatMoney(candidate.amount - item.amount)}<br/><small>{matchAction(candidate)}</small></span> : "—"}</td><td><button className="btn secondary" type="button" onClick={() => approveBestMatch(item.id)}>Usar candidato</button><br/><select style={{ marginTop: 8 }} value={item.status} onChange={(event) => updateStatus(item.id, event.target.value as PurchaseItem["status"])}>{purchaseStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></td></tr>; })}</tbody>
        </table>
      </section>
    </div>
  );
}
