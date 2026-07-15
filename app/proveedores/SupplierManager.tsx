"use client";

import { FormEvent, useMemo, useState } from "react";

export type SupplierDirectoryRow = {
  id: string;
  name: string;
  category?: string | null;
  email?: string | null;
  phone?: string | null;
  tax_id?: string | null;
  country?: string | null;
  notes?: string | null;
  active?: boolean;
  holded_contact_id?: string | null;
  purchase_count?: number;
  pending_count?: number;
  expected_total?: number;
  approved_total?: number;
  invoiced_total?: number;
};

type Draft = {
  name: string;
  category: string;
  email: string;
  phone: string;
  tax_id: string;
  country: string;
  notes: string;
  active: boolean;
};

const emptyDraft: Draft = { name: "", category: "", email: "", phone: "", tax_id: "", country: "", notes: "", active: true };

function normalize(input: unknown): SupplierDirectoryRow {
  const row = input as Record<string, unknown>;
  return {
    id: String(row.id || crypto.randomUUID()),
    name: String(row.name || "Proveedor"),
    category: row.category ? String(row.category) : null,
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
    tax_id: row.tax_id ? String(row.tax_id) : null,
    country: row.country ? String(row.country) : null,
    notes: row.notes ? String(row.notes) : null,
    active: row.active !== false,
    holded_contact_id: row.holded_contact_id ? String(row.holded_contact_id) : null,
    purchase_count: Number(row.purchase_count || 0),
    pending_count: Number(row.pending_count || 0),
    expected_total: Number(row.expected_total || 0),
    approved_total: Number(row.approved_total || 0),
    invoiced_total: Number(row.invoiced_total || 0),
  };
}

function money(value: unknown) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function draftFromSupplier(supplier: SupplierDirectoryRow): Draft {
  return {
    name: supplier.name,
    category: supplier.category || "",
    email: supplier.email || "",
    phone: supplier.phone || "",
    tax_id: supplier.tax_id || "",
    country: supplier.country || "",
    notes: supplier.notes || "",
    active: supplier.active !== false,
  };
}

export function SupplierManager({ initialSuppliers = [] }: { initialSuppliers?: unknown[] }) {
  const [items, setItems] = useState<SupplierDirectoryRow[]>(() => initialSuppliers.map(normalize));
  const [selectedId, setSelectedId] = useState<string | null>(() => items[0]?.id || null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("active");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "active" && item.active === false) return false;
      if (filter === "inactive" && item.active !== false) return false;
      if (!needle) return true;
      return [item.name, item.category, item.email, item.phone, item.tax_id, item.country].filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [filter, items, query]);

  const selected = items.find((item) => item.id === selectedId) || filtered[0] || items[0] || null;
  const activeCount = items.filter((item) => item.active !== false).length;
  const pendingCount = items.reduce((sum, item) => sum + Number(item.pending_count || 0), 0);
  const expectedTotal = items.reduce((sum, item) => sum + Number(item.expected_total || 0), 0);
  const approvedTotal = items.reduce((sum, item) => sum + Number(item.approved_total || 0), 0);

  function changeDraft(key: keyof Draft, value: Draft[keyof Draft]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function startCreate() {
    setDraft(emptyDraft);
    setShowCreate(true);
    setEditing(false);
    setMessage(null);
  }

  function startEdit() {
    if (!selected) return;
    setDraft(draftFromSupplier(selected));
    setEditing(true);
    setShowCreate(false);
    setMessage(null);
  }

  async function saveSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draft.name.trim();
    if (name.length < 2) return setMessage("Introduce un nombre de proveedor válido.");
    setSaving(true);
    setMessage(null);
    const endpoint = editing && selected ? `/api/routsify/suppliers/${encodeURIComponent(selected.id)}` : "/api/routsify/suppliers";
    const response = await fetch(endpoint, {
      method: editing ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...draft, name }),
    });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok || !result?.ok) {
      if (result?.error === "supplier_already_exists") return setMessage("Ya existe un proveedor con ese nombre.");
      return setMessage(String(result?.error || "No se pudo guardar el proveedor."));
    }
    const saved = normalize({ ...result.data, purchase_count: selected?.purchase_count || 0, pending_count: selected?.pending_count || 0, expected_total: selected?.expected_total || 0, approved_total: selected?.approved_total || 0, invoiced_total: selected?.invoiced_total || 0 });
    setItems((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
    setSelectedId(saved.id);
    setShowCreate(false);
    setEditing(false);
    setDraft(emptyDraft);
    setMessage(editing ? "Proveedor actualizado." : "Proveedor creado y disponible en presupuestos y compras.");
  }

  async function toggleActive() {
    if (!selected) return;
    setSaving(true);
    setMessage(null);
    const response = await fetch(`/api/routsify/suppliers/${encodeURIComponent(selected.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: selected.active === false }),
    });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo actualizar el proveedor."));
    const updated = normalize({ ...result.data, purchase_count: selected.purchase_count, pending_count: selected.pending_count, expected_total: selected.expected_total, approved_total: selected.approved_total, invoiced_total: selected.invoiced_total });
    setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
    setMessage(updated.active === false ? "Proveedor desactivado. Se conserva todo su historial." : "Proveedor reactivado.");
  }

  const form = (editing || showCreate) ? <section className="creation-panel">
    <div className="creation-panel-header"><div><div className="eyebrow">{editing ? "Editar proveedor" : "Nuevo proveedor"}</div><h2>{editing ? selected?.name : "Alta en el directorio"}</h2><p>El proveedor se reutiliza en presupuestos, compras y facturas para evitar nombres duplicados.</p></div></div>
    <form className="form" onSubmit={saveSupplier}>
      <div className="grid grid-2"><label>Nombre *<input className="input" required value={draft.name} onChange={(event) => changeDraft("name", event.target.value)} /></label><label>Categoría<input className="input" placeholder="Hotel, aerolínea, DMC, seguro..." value={draft.category} onChange={(event) => changeDraft("category", event.target.value)} /></label></div>
      <div className="grid grid-2"><label>Email<input className="input" type="email" value={draft.email} onChange={(event) => changeDraft("email", event.target.value)} /></label><label>Teléfono<input className="input" value={draft.phone} onChange={(event) => changeDraft("phone", event.target.value)} /></label></div>
      <div className="grid grid-2"><label>NIF / ID fiscal<input className="input" value={draft.tax_id} onChange={(event) => changeDraft("tax_id", event.target.value)} /></label><label>País<input className="input" value={draft.country} onChange={(event) => changeDraft("country", event.target.value)} /></label></div>
      <label>Notas<textarea className="input" rows={4} value={draft.notes} onChange={(event) => changeDraft("notes", event.target.value)} /></label>
      <label><input type="checkbox" checked={draft.active} onChange={(event) => changeDraft("active", event.target.checked)} /> Proveedor activo y seleccionable</label>
      <div className="form-actions"><button className="btn secondary" type="button" onClick={() => { setEditing(false); setShowCreate(false); setDraft(emptyDraft); }}>Cancelar</button><button className="btn" disabled={saving}>{saving ? "Guardando..." : "Guardar proveedor"}</button></div>
    </form>
  </section> : null;

  return <div className="clients-page">
    <section className="client-kpis"><div className="kpi-card"><span className="kpi-icon">P</span><span className="kpi-copy"><strong>Proveedores activos</strong><b>{activeCount}</b><small>Directorio reutilizable</small></span></div><div className="kpi-card"><span className="kpi-icon">!</span><span className="kpi-copy"><strong>Compras pendientes</strong><b>{pendingCount}</b><small>Por cerrar o revisar</small></span></div><div className="kpi-card"><span className="kpi-icon">€</span><span className="kpi-copy"><strong>Coste presupuestado</strong><b>{money(expectedTotal)}</b><small>Compras vinculadas</small></span></div><div className="kpi-card"><span className="kpi-icon">R</span><span className="kpi-copy"><strong>Coste aprobado</strong><b>{money(approvedTotal)}</b><small>Coste real validado</small></span></div></section>
    <section className="clients-layout"><div className="card clients-main"><div className="client-filters client-filters-wide"><input className="input" placeholder="Buscar proveedor, categoría, email o país..." value={query} onChange={(event) => setQuery(event.target.value)} /><label>Estado<select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="active">Activos</option><option value="inactive">Inactivos</option><option value="all">Todos</option></select></label><button className="btn" type="button" onClick={startCreate}>Nuevo proveedor</button></div>
      {message ? <p className="client-message" role="status">{message}</p> : null}
      {form}
      {filtered.length ? <div className="table-scroll"><table><thead><tr><th>Proveedor</th><th>Categoría</th><th>Compras</th><th>Pendientes</th><th>Presupuestado</th><th>Real aprobado</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id} className={item.id === selected?.id ? "selected-row" : ""}><td><button className="table-link" type="button" onClick={() => { setSelectedId(item.id); setEditing(false); setShowCreate(false); }}><strong>{item.name}</strong><br /><small>{item.active === false ? "Inactivo" : item.email || item.phone || "Sin contacto"}</small></button></td><td>{item.category || "—"}</td><td>{item.purchase_count || 0}</td><td>{item.pending_count || 0}</td><td>{money(item.expected_total)}</td><td>{money(item.approved_total)}</td></tr>)}</tbody></table></div> : <div className="empty-state"><h2>No hay proveedores</h2><p>Crea el primero para reutilizarlo en presupuestos y compras.</p></div>}
    </div><aside className="client-side card">{selected ? <><div className="client-side-header compact"><div><h2>{selected.name}</h2><p>{selected.category || "Sin categoría"}<br />{selected.active === false ? "Inactivo" : "Activo"}</p></div></div>
      <section className="side-section"><h3>Contacto y fiscal</h3><table><tbody><tr><th>Email</th><td>{selected.email || "—"}</td></tr><tr><th>Teléfono</th><td>{selected.phone || "—"}</td></tr><tr><th>País</th><td>{selected.country || "—"}</td></tr><tr><th>ID fiscal</th><td>{selected.tax_id || "—"}</td></tr><tr><th>Holded</th><td>{selected.holded_contact_id ? "Vinculado" : "Pendiente"}</td></tr></tbody></table></section>
      <section className="side-section"><h3>Histórico económico</h3><table><tbody><tr><th>Compras</th><td>{selected.purchase_count || 0}</td></tr><tr><th>Pendientes</th><td>{selected.pending_count || 0}</td></tr><tr><th>Coste presupuestado</th><td>{money(selected.expected_total)}</td></tr><tr><th>Coste real aprobado</th><td>{money(selected.approved_total)}</td></tr><tr><th>Facturado registrado</th><td>{money(selected.invoiced_total)}</td></tr></tbody></table></section>
      <section className="side-section"><h3>Notas</h3><p>{selected.notes || "Sin notas internas."}</p><div className="form-actions"><button className="btn" type="button" onClick={startEdit}>Editar</button><a className="btn secondary" href={`/compras?supplierId=${encodeURIComponent(selected.id)}`}>Ver compras</a><button className="btn secondary" type="button" disabled={saving} onClick={() => void toggleActive()}>{selected.active === false ? "Reactivar" : "Desactivar"}</button></div></section>
    </> : <div className="empty-state"><h2>Selecciona un proveedor</h2></div>}</aside></section>
  </div>;
}
