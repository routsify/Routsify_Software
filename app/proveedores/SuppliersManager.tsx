"use client";

import { FormEvent, useMemo, useState } from "react";
import { expectedPurchases } from "@/lib/mock-data";
import { demoSuppliers, supplierRisks, supplierStatuses, supplierSummary, SupplierItem } from "@/lib/suppliers";
import { canActivateSupplier, supplierBlockers, supplierNextAction, supplierPurchaseStats } from "@/lib/supplier-rules";
import { isDemoMode } from "@/lib/supabase-browser";

type SupplierDraft = {
  name: string;
  category: string;
  destination: string;
  contact_name: string;
  email: string;
  phone: string;
  payment_terms: string;
  cancellation_terms: string;
  response_time_hours: string;
  notes: string;
};

const emptyDraft: SupplierDraft = {
  name: "",
  category: "hotel",
  destination: "",
  contact_name: "",
  email: "",
  phone: "",
  payment_terms: "",
  cancellation_terms: "",
  response_time_hours: "48",
  notes: "",
};

export function SuppliersManager() {
  const [items, setItems] = useState<SupplierItem[]>(demoSuppliers);
  const [draft, setDraft] = useState<SupplierDraft>(emptyDraft);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const summary = useMemo(() => supplierSummary(items), [items]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return items;
    return items.filter((item) => [item.name, item.category, item.destination, item.contact_name, item.status, item.risk].some((value) => String(value ?? "").toLowerCase().includes(text)));
  }, [items, query]);

  function updateDraft<K extends keyof SupplierDraft>(key: K, value: SupplierDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function addSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim()) {
      setMessage("Añade el nombre del proveedor.");
      return;
    }
    const item: SupplierItem = {
      id: `supplier-${Date.now()}`,
      name: draft.name.trim(),
      category: draft.category.trim() || "general",
      destination: draft.destination.trim() || "Global",
      contact_name: draft.contact_name.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      status: "candidate",
      risk: "medium",
      payment_terms: draft.payment_terms.trim(),
      cancellation_terms: draft.cancellation_terms.trim() || undefined,
      preferred: false,
      response_time_hours: Number(draft.response_time_hours) || undefined,
      notes: draft.notes.trim() || undefined,
    };
    setItems((current) => [item, ...current]);
    setDraft(emptyDraft);
    setMessage(isDemoMode() ? "Proveedor creado como candidato. Debe revisarse antes de usarse como preferente." : "Proveedor creado.");
  }

  function updateSupplier(id: string, patch: Partial<SupplierItem>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function reviewSupplier(id: string) {
    const current = items.find((item) => item.id === id);
    if (!current) return;
    if (!canActivateSupplier(current, items)) {
      const blockers = supplierBlockers(current, items);
      setItems((list) => list.map((item) => item.id === id ? { ...item, status: "review_required", notes: blockers.join(" · ") || item.notes } : item));
      setMessage("Proveedor pendiente de revisión: " + (blockers.join(" · ") || "faltan datos"));
      return;
    }
    setItems((list) => list.map((item) => item.id === id ? { ...item, status: "active", last_reviewed_at: new Date().toISOString().slice(0, 10), reviewed_by: "Operaciones Demo" } : item));
    setMessage("Proveedor revisado. Puede usarse en presupuestos y compras esperadas.");
  }

  function togglePreferred(id: string) {
    setItems((list) => list.map((item) => item.id === id ? { ...item, preferred: !item.preferred } : item));
  }

  return (
    <div className="grid">
      <section className="grid grid-3">
        <div className="card"><span className="badge">Proveedores</span><div className="metric">{summary.total}</div><p>Base operativa para compras esperadas.</p></div>
        <div className="card"><span className="badge">Activos</span><div className="metric">{summary.active}</div><p>{summary.preferred} preferentes para presupuestar.</p></div>
        <div className="card"><span className="badge">A revisar</span><div className="metric">{summary.review}</div><p>{summary.highRisk} con riesgo alto · {summary.paused} pausados.</p></div>
      </section>

      <section className="grid grid-2">
        <div className="card">
          <div className="eyebrow">Nuevo proveedor</div>
          <h2>Alta operativa</h2>
          <form className="form" onSubmit={addSupplier}>
            <label>Nombre<input className="input" value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} /></label>
            <div className="grid grid-2"><label>Categoría<input className="input" value={draft.category} onChange={(event) => updateDraft("category", event.target.value)} /></label><label>Destino<input className="input" value={draft.destination} onChange={(event) => updateDraft("destination", event.target.value)} /></label></div>
            <div className="grid grid-3"><label>Contacto<input className="input" value={draft.contact_name} onChange={(event) => updateDraft("contact_name", event.target.value)} /></label><label>Email<input className="input" value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} /></label><label>Teléfono<input className="input" value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} /></label></div>
            <label>Condiciones de pago<input className="input" value={draft.payment_terms} onChange={(event) => updateDraft("payment_terms", event.target.value)} /></label>
            <label>Condiciones de cancelación<input className="input" value={draft.cancellation_terms} onChange={(event) => updateDraft("cancellation_terms", event.target.value)} /></label>
            <label>Tiempo respuesta estimado en horas<input className="input" type="number" min="0" value={draft.response_time_hours} onChange={(event) => updateDraft("response_time_hours", event.target.value)} /></label>
            <label>Notas<textarea className="input" rows={3} value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} /></label>
            {message ? <p>{message}</p> : null}
            <button className="btn" type="submit">Crear proveedor</button>
          </form>
        </div>

        <div className="card">
          <div className="eyebrow">Regla MVP</div>
          <h2>Proveedores antes de compras</h2>
          <p>Las líneas de presupuesto que generan compra esperada deben poder vincularse a proveedores revisados. En MVP la revisión es manual y trazable.</p>
          <table><tbody><tr><th>Uso</th><td>Presupuestos y compras esperadas</td></tr><tr><th>Revisión</th><td>Contacto, condiciones, riesgo y fecha</td></tr><tr><th>Preferente</th><td>Solo proveedor activo y revisado</td></tr></tbody></table>
        </div>
      </section>

      <section className="card">
        <div className="header" style={{ marginBottom: 0 }}>
          <div><div className="eyebrow">Base de proveedores</div><h2>{filtered.length} resultados</h2></div>
          <input className="input" style={{ maxWidth: 320 }} placeholder="Buscar proveedor" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <table>
          <thead><tr><th>Proveedor</th><th>Destino</th><th>Contacto</th><th>Estado</th><th>Riesgo</th><th>Compras</th><th>Siguiente acción</th><th>Acción</th></tr></thead>
          <tbody>{filtered.map((item) => { const blockers = supplierBlockers(item, items); const stats = supplierPurchaseStats(item, expectedPurchases); return <tr key={item.id}><td><strong>{item.name}</strong><br/><small>{item.category} · {item.preferred ? "preferente" : "no preferente"}</small></td><td>{item.destination}</td><td>{item.contact_name || "—"}<br/><small>{item.email || item.phone || "sin contacto"}</small></td><td><select value={item.status} onChange={(event) => updateSupplier(item.id, { status: event.target.value as SupplierItem["status"] })}>{supplierStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></td><td><select value={item.risk} onChange={(event) => updateSupplier(item.id, { risk: event.target.value as SupplierItem["risk"] })}>{supplierRisks.map((risk) => <option key={risk} value={risk}>{risk}</option>)}</select></td><td>{stats.total} vinculadas<br/><small>{stats.open} abiertas · {stats.amount.toLocaleString("es-ES")} €</small></td><td>{supplierNextAction(item, items)}<br/><small>{blockers.length ? blockers.join(" · ") : item.payment_terms}</small></td><td><button className="btn secondary" type="button" onClick={() => reviewSupplier(item.id)}>Revisar</button><br/><button className="btn secondary" type="button" onClick={() => togglePreferred(item.id)} style={{ marginTop: 8 }}>Preferente</button></td></tr>; })}</tbody>
        </table>
      </section>
    </div>
  );
}
