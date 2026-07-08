"use client";

import { FormEvent, useMemo, useState } from "react";
import { expectedPurchases as demoPurchases } from "@/lib/mock-data";
import { formatMoney, PurchaseItem, purchaseStatuses, purchaseTotals } from "@/lib/purchases";
import { isDemoMode } from "@/lib/supabase-browser";

function toPurchaseItems(): PurchaseItem[] {
  return demoPurchases.map((item, index) => ({
    id: `purchase-${index + 1}`,
    case_code: item.case_code,
    supplier: item.supplier,
    service: item.service,
    status: item.status as PurchaseItem["status"],
    amount: item.amount,
  }));
}

export function PurchasesManager() {
  const [items, setItems] = useState<PurchaseItem[]>(toPurchaseItems());
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [fileName, setFileName] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const totals = useMemo(() => purchaseTotals(items), [items]);

  function updateStatus(id: string, status: PurchaseItem["status"]) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item));
  }

  function attachInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const current = items.find((item) => item.id === selectedId);
    if (!current) return;

    const fallbackFileName = `${current.case_code}-${current.supplier}`.replace(/\s+/g, "_") + ".pdf";
    setItems((list) => list.map((item) => item.id === selectedId ? {
      ...item,
      status: "invoice_uploaded",
      invoice_file: fileName.trim() || fallbackFileName,
      invoice_number: invoiceNumber.trim() || undefined,
      notes: notes.trim() || undefined,
    } : item));
    setInvoiceNumber("");
    setFileName("");
    setNotes("");
    setMessage(isDemoMode() ? "Factura marcada como subida en modo demo. La subida real irá al bucket privado de Supabase." : "Factura vinculada a la compra esperada.");
  }

  return (
    <div className="grid">
      <section className="grid grid-3">
        <div className="card"><span className="badge">Compras esperadas</span><div className="metric">{totals.count}</div><p>Líneas de presupuesto que generan factura proveedor.</p></div>
        <div className="card"><span className="badge">Pendiente de conciliar</span><div className="metric">{formatMoney(totals.pendingAmount)}</div><p>{totals.pendingCount} compras todavía no aprobadas.</p></div>
        <div className="card"><span className="badge">Facturas subidas</span><div className="metric">{totals.uploadedCount}</div><p>Revisión manual, sin OCR ni automatismos en MVP.</p></div>
      </section>

      <section className="grid grid-2">
        <div className="card">
          <div className="eyebrow">Subida manual</div>
          <h2>Registrar factura proveedor</h2>
          <form className="form" onSubmit={attachInvoice}>
            <label>Compra esperada
              <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                {items.map((item) => <option key={item.id} value={item.id}>{item.case_code} · {item.supplier} · {formatMoney(item.amount)}</option>)}
              </select>
            </label>
            <label>Número de factura<input className="input" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="FAC-2026-0001" /></label>
            <label>Nombre de archivo<input className="input" value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder="factura-proveedor.pdf" /></label>
            <label>Notas de revisión<textarea className="input" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Diferencia con presupuesto, IVA, vencimiento, etc." /></label>
            {message ? <p>{message}</p> : null}
            <button className="btn" type="submit">Marcar factura subida</button>
          </form>
        </div>

        <div className="card">
          <div className="eyebrow">Criterio de cierre</div>
          <h2>Checklist operativo</h2>
          <table>
            <tbody>
              <tr><th>Facturas aprobadas</th><td>{totals.approvedCount}/{totals.count}</td></tr>
              <tr><th>Importe previsto total</th><td>{formatMoney(totals.total)}</td></tr>
              <tr><th>Modo actual</th><td>{isDemoMode() ? "Demo" : "Supabase"}</td></tr>
              <tr><th>Cierre recomendado</th><td><span className="badge">{totals.pendingCount === 0 ? "ready_to_close" : "suppliers_pending"}</span></td></tr>
            </tbody>
          </table>
          <p>El expediente no debería cerrarse hasta que todas las compras esperadas estén aprobadas o justificadas.</p>
        </div>
      </section>

      <section className="card">
        <table>
          <thead><tr><th>Expediente</th><th>Proveedor</th><th>Servicio</th><th>Estado</th><th>Importe</th><th>Factura</th><th>Acción</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.case_code}</strong></td>
                <td>{item.supplier}</td>
                <td>{item.service}</td>
                <td><span className="badge">{item.status}</span></td>
                <td>{formatMoney(item.amount)}</td>
                <td>{item.invoice_file ? <span>{item.invoice_file}<br/><small>{item.invoice_number || "sin número"}</small></span> : "—"}</td>
                <td>
                  <select value={item.status} onChange={(event) => updateStatus(item.id, event.target.value as PurchaseItem["status"])}>
                    {purchaseStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
