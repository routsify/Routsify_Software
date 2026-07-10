"use client";

import { useMemo, useState } from "react";

type PurchaseRow = {
  id: string;
  supplier_name?: string | null;
  service?: string | null;
  status?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  review_notes?: string | null;
};

const statuses = [
  ["pending", "Pendiente"],
  ["requested", "Solicitada"],
  ["received", "Recibida"],
  ["review", "Revisar"],
  ["not_required", "No necesaria"],
  ["cancelled", "Cancelada"],
];

function normalize(input: unknown): PurchaseRow {
  const row = input as Record<string, unknown>;
  return {
    id: String(row.id || crypto.randomUUID()),
    supplier_name: row.supplier_name ? String(row.supplier_name) : null,
    service: row.service ? String(row.service) : null,
    status: row.status ? String(row.status) : "pending",
    amount: typeof row.amount === "number" || typeof row.amount === "string" ? row.amount : null,
    currency: row.currency ? String(row.currency) : "EUR",
    review_notes: row.review_notes ? String(row.review_notes) : null,
  };
}

function statusLabel(status?: string | null) {
  return statuses.find(([value]) => value === status)?.[1] || status || "Pendiente";
}

function money(value?: string | number | null, currency = "EUR") {
  const numeric = Number(value || 0);
  if (!numeric) return "—";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(numeric);
}

export function PurchasesManager({ initialPurchases = [] }: { initialPurchases?: unknown[] }) {
  const [items, setItems] = useState<PurchaseRow[]>(() => initialPurchases.map(normalize));
  const [selectedId, setSelectedId] = useState<string | null>(() => items[0]?.id || null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Todos");
  const [message, setMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStatus = status === "Todos" || item.status === status;
      const matchesText = !needle || [item.supplier_name, item.service, item.status].filter(Boolean).join(" ").toLowerCase().includes(needle);
      return matchesStatus && matchesText;
    });
  }, [items, search, status]);

  const selected = items.find((item) => item.id === selectedId) || filtered[0] || items[0] || null;
  const pending = items.filter((item) => !["received", "cancelled", "not_required"].includes(String(item.status))).length;
  const received = items.filter((item) => item.status === "received").length;
  const review = items.filter((item) => item.status === "review" || item.status === "review_needed").length;
  const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  async function updateStatus(id: string, nextStatus: string) {
    setSavingId(id);
    setMessage(null);
    const response = await fetch(`/api/routsify/expected-purchases/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const result = await response.json().catch(() => null);
    setSavingId(null);

    if (!response.ok || !result?.ok) {
      setMessage("No se pudo actualizar el estado de la compra.");
      return;
    }

    const updated = normalize(result.data);
    setItems((current) => current.map((item) => item.id === id ? updated : item));
    setSelectedId(updated.id);
    setMessage("Estado actualizado correctamente.");
  }

  return (
    <div className="clients-page">
      <section className="client-kpis">
        <div className="kpi-card"><span className="kpi-icon">C</span><span className="kpi-copy"><strong>Compras</strong><b>{items.length}</b><small>Total registradas</small></span></div>
        <div className="kpi-card"><span className="kpi-icon">P</span><span className="kpi-copy"><strong>Pendientes</strong><b>{pending}</b><small>Por resolver</small></span></div>
        <div className="kpi-card"><span className="kpi-icon">R</span><span className="kpi-copy"><strong>Revisión</strong><b>{review}</b><small>Necesitan decisión</small></span></div>
        <div className="kpi-card"><span className="kpi-icon">€</span><span className="kpi-copy"><strong>Importe</strong><b>{money(total)}</b><small>Registrado</small></span></div>
      </section>

      <section className="clients-layout">
        <div className="card clients-main" id="compras-listado">
          <div className="client-filters client-filters-simple">
            <input className="input" placeholder="Buscar proveedor o servicio..." value={search} onChange={(event) => setSearch(event.target.value)} />
            <label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option>Todos</option>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          {message ? <p className="client-message">{message}</p> : null}

          {items.length === 0 ? (
            <div className="empty-state"><h2>Todavía no hay compras</h2><p>Las compras aparecerán cuando se creen desde presupuestos o se registren manualmente.</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><h2>No hay coincidencias</h2><p>Cambia la búsqueda o el filtro para ver otras compras.</p></div>
          ) : (
            <table>
              <thead><tr><th>Proveedor</th><th>Servicio</th><th>Importe</th><th>Estado</th></tr></thead>
              <tbody>{filtered.map((item) => <tr key={item.id} className={item.id === selected?.id ? "selected-row" : ""}><td><button className="table-link" type="button" onClick={() => setSelectedId(item.id)}><strong>{item.supplier_name || "Proveedor"}</strong></button></td><td>{item.service || "—"}</td><td>{money(item.amount, item.currency || "EUR")}</td><td><select value={item.status || "pending"} onChange={(event) => void updateStatus(item.id, event.target.value)} disabled={savingId === item.id}>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td></tr>)}</tbody>
            </table>
          )}
        </div>

        <aside className="client-side card">
          {selected ? (
            <>
              <div className="client-side-header"><div><h2>{selected.supplier_name || "Proveedor"}</h2><p>{selected.service || "Servicio"}</p></div><span className="status-pill status-progress">{statusLabel(selected.status)}</span></div>
              <section className="side-section"><h3>Resumen</h3><table><tbody><tr><th>Importe</th><td>{money(selected.amount, selected.currency || "EUR")}</td></tr><tr><th>Estado</th><td>{statusLabel(selected.status)}</td></tr><tr><th>Notas</th><td>{selected.review_notes || "—"}</td></tr></tbody></table></section>
              <section className="side-actions"><h3>Cambiar estado</h3>{statuses.map(([value, label]) => <button key={value} className={value === selected.status ? "quick-action primary" : "quick-action"} type="button" onClick={() => void updateStatus(selected.id, value)} disabled={savingId === selected.id}>{label}<span>→</span></button>)}</section>
            </>
          ) : (
            <div className="empty-state"><h2>Sin compra seleccionada</h2><p>Selecciona una compra para ver el detalle.</p></div>
          )}
        </aside>
      </section>
    </div>
  );
}
