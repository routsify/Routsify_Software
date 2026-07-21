"use client";

import { FormEvent, useState } from "react";
import { usePermission } from "@/components/PermissionProvider";

export type SupplierDirectoryRow = {
  id: string;
  name: string;
  category?: string | null;
  email?: string | null;
  phone?: string | null;
  tax_id?: string | null;
  country?: string | null;
  billing_address?: unknown;
  notes?: string | null;
  active?: boolean;
  holded_contact_id?: string | null;
  default_margin_pct?: number | null;
  purchase_count?: number;
  pending_count?: number;
  expected_total?: number;
  approved_total?: number;
  invoiced_total?: number;
  created_at?: string | null;
  updated_at?: string | null;
};

type Draft = {
  name: string;
  category: string;
  email: string;
  phone: string;
  tax_id: string;
  country: string;
  billing_address: string;
  notes: string;
  default_margin_pct: string;
  active: boolean;
};

type SupplierStats = {
  total: number;
  active: number;
  linkedToHolded: number;
  fiscalComplete: number;
  pendingPurchases: number;
  expectedTotal: number;
  approvedTotal: number;
  invoicedTotal: number;
};

type SupplierPage = {
  items: unknown[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query: string;
  status: "all" | "active" | "inactive";
  stats: SupplierStats;
};

type ImportSummary = {
  totalRows: number;
  imported: number;
  duplicates: number;
  invalid: number;
  errors: Array<{ row: number; message: string }>;
};

const emptyDraft: Draft = { name: "", category: "", email: "", phone: "", tax_id: "", country: "ES", billing_address: "", notes: "", default_margin_pct: "", active: true };
const pageSizes = [50, 100, 150, 200];

function normalize(input: unknown): SupplierDirectoryRow {
  const row = input as Record<string, unknown>;
  return {
    id: String(row.id || crypto.randomUUID()),
    name: String(row.name || "Proveedor sin nombre"),
    category: row.category ? String(row.category) : null,
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
    tax_id: row.tax_id ? String(row.tax_id) : null,
    country: row.country ? String(row.country) : null,
    billing_address: row.billing_address || null,
    notes: row.notes ? String(row.notes) : null,
    active: row.active !== false,
    holded_contact_id: row.holded_contact_id ? String(row.holded_contact_id) : null,
    default_margin_pct: row.default_margin_pct === null || row.default_margin_pct === undefined ? null : Number(row.default_margin_pct),
    purchase_count: Number(row.purchase_count || 0),
    pending_count: Number(row.pending_count || 0),
    expected_total: Number(row.expected_total || 0),
    approved_total: Number(row.approved_total || 0),
    invoiced_total: Number(row.invoiced_total || 0),
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
  };
}

function money(value: unknown) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function billingAddressText(value: unknown) {
  if (!value) return "—";
  if (typeof value === "string") return value || "—";
  if (typeof value === "object" && value && "address" in value) return String((value as { address?: unknown }).address || "—");
  return "—";
}

function draftFromSupplier(supplier: SupplierDirectoryRow): Draft {
  return {
    name: supplier.name,
    category: supplier.category || "",
    email: supplier.email || "",
    phone: supplier.phone || "",
    tax_id: supplier.tax_id || "",
    country: supplier.country || "ES",
    billing_address: billingAddressText(supplier.billing_address) === "—" ? "" : billingAddressText(supplier.billing_address),
    notes: supplier.notes || "",
    default_margin_pct: supplier.default_margin_pct === null || supplier.default_margin_pct === undefined ? "" : String(supplier.default_margin_pct),
    active: supplier.active !== false,
  };
}

function supplierInitials(supplier?: SupplierDirectoryRow | null) {
  if (!supplier?.name) return "--";
  return supplier.name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function importErrorMessage(result: unknown) {
  const error = String((result as { error?: unknown } | null)?.error || "");
  if (error === "import_file_required") return "Selecciona un archivo CSV.";
  if (error === "import_csv_required") return "La importación requiere un archivo CSV basado en la plantilla.";
  if (error === "import_file_too_large") return "El archivo supera el máximo permitido de 5 MB.";
  if (error === "empty_import_file") return "El archivo está vacío.";
  if (error === "import_file_has_no_rows") return "La plantilla no contiene proveedores para importar.";
  if (error === "import_name_column_required") return "No se encuentra la columna nombre en la plantilla.";
  if (error === "import_row_limit_exceeded") return "Puedes importar un máximo de 2.000 proveedores por archivo.";
  return "No se pudo completar la importación.";
}

export function SupplierManager({ initialPage, initialSupplierId = "" }: { initialPage: SupplierPage; initialSupplierId?: string }) {
  const canManage = usePermission("suppliers.manage");
  const [items, setItems] = useState<SupplierDirectoryRow[]>(() => initialPage.items.map(normalize));
  const [selectedId, setSelectedId] = useState<string | null>(() => items.some((item) => item.id === initialSupplierId) ? initialSupplierId : items[0]?.id || null);
  const [page, setPage] = useState(initialPage.page);
  const [pageSize, setPageSize] = useState(initialPage.pageSize);
  const [total, setTotal] = useState(initialPage.total);
  const [totalPages, setTotalPages] = useState(initialPage.totalPages);
  const [stats, setStats] = useState<SupplierStats>(initialPage.stats);
  const [queryInput, setQueryInput] = useState(initialPage.query || "");
  const [query, setQuery] = useState(initialPage.query || "");
  const [status, setStatus] = useState<SupplierPage["status"]>(initialPage.status || "active");
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const selected = items.find((item) => item.id === selectedId) || items[0] || null;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  function changeDraft<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  function changeEditDraft<K extends keyof Draft>(key: K, value: Draft[K]) { setEditDraft((current) => ({ ...current, [key]: value })); }

  async function loadPage(nextPage: number, nextPageSize = pageSize, nextQuery = query, nextStatus = status) {
    setLoading(true);
    const params = new URLSearchParams({ paginated: "1", page: String(nextPage), pageSize: String(nextPageSize), status: nextStatus });
    if (nextQuery) params.set("q", nextQuery);
    const response = await fetch(`/api/routsify/suppliers?${params.toString()}`, { cache: "no-store" });
    const result = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok || !result?.ok || !result?.data) {
      setMessage("No se pudo cargar la página de proveedores.");
      return false;
    }
    const data = result.data as SupplierPage;
    const rows = data.items.map(normalize);
    setItems(rows);
    setPage(data.page);
    setPageSize(data.pageSize);
    setTotal(data.total);
    setTotalPages(data.totalPages);
    setStats(data.stats);
    setQuery(data.query);
    setStatus(data.status);
    setSelectedId(rows.some((item) => item.id === selectedId) ? selectedId : rows[0]?.id || null);
    setShowEdit(false);
    return true;
  }

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = queryInput.trim();
    setQuery(nextQuery);
    await loadPage(1, pageSize, nextQuery, status);
  }

  async function clearSearch() {
    setQueryInput("");
    setQuery("");
    await loadPage(1, pageSize, "", status);
  }

  async function changeStatus(nextStatus: SupplierPage["status"]) {
    setStatus(nextStatus);
    await loadPage(1, pageSize, query, nextStatus);
  }

  async function saveSupplier(event: FormEvent<HTMLFormElement>, editing: boolean) {
    event.preventDefault();
    if (!canManage) return setMessage("Tu rol tiene acceso de consulta a proveedores.");
    const source = editing ? editDraft : draft;
    const name = source.name.trim();
    if (name.length < 2) return setMessage("Introduce un nombre de proveedor válido.");
    setSaving(true); setMessage(null);
    const endpoint = editing && selected ? `/api/routsify/suppliers/${encodeURIComponent(selected.id)}` : "/api/routsify/suppliers";
    const response = await fetch(endpoint, {
      method: editing ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        category: source.category.trim() || null,
        email: source.email.trim() || null,
        phone: source.phone.trim() || null,
        tax_id: source.tax_id.trim() || null,
        country: source.country.trim().toUpperCase() || "ES",
        billing_address: source.billing_address.trim() ? { address: source.billing_address.trim() } : {},
        notes: source.notes.trim() || null,
        default_margin_pct: source.default_margin_pct === "" ? null : Number(source.default_margin_pct.replace(",", ".")),
        active: source.active,
      }),
    });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok || !result?.ok) {
      if (result?.error === "supplier_already_exists") return setMessage("Ya existe un proveedor con ese nombre o identificación.");
      return setMessage(String(result?.error || "No se pudo guardar el proveedor."));
    }
    setShowCreate(false); setShowEdit(false); setDraft(emptyDraft); setEditDraft(emptyDraft);
    setQueryInput(""); setQuery("");
    await loadPage(1, pageSize, "", status);
    setMessage(editing ? "Proveedor actualizado correctamente." : "Proveedor creado y disponible en presupuestos y compras.");
  }

  async function toggleActive() {
    if (!selected || !canManage) return;
    setSaving(true); setMessage(null);
    const response = await fetch(`/api/routsify/suppliers/${encodeURIComponent(selected.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: selected.active === false }),
    });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok || !result?.ok) return setMessage(String(result?.error || "No se pudo actualizar el proveedor."));
    await loadPage(page, pageSize, query, status);
    setMessage(selected.active === false ? "Proveedor reactivado." : "Proveedor desactivado. Se conserva todo su historial.");
  }

  async function importSuppliers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return setMessage("Tu rol tiene acceso de consulta a proveedores.");
    if (!importFile) return setMessage("Selecciona el archivo CSV completado.");
    setImporting(true); setMessage(null); setImportSummary(null);
    const form = new FormData(); form.set("file", importFile);
    const response = await fetch("/api/routsify/suppliers/import", { method: "POST", body: form });
    const result = await response.json().catch(() => null);
    setImporting(false);
    if (!response.ok || !result?.ok) return setMessage(importErrorMessage(result));
    const summary = result.data as ImportSummary;
    setImportSummary(summary); setImportFile(null); setQueryInput(""); setQuery("");
    await loadPage(1, pageSize, "", status);
    setMessage(`Importación terminada: ${summary.imported} proveedores creados, ${summary.duplicates} duplicados omitidos y ${summary.invalid} filas con errores.`);
  }

  function startEdit() {
    if (!selected || !canManage) return;
    setEditDraft(draftFromSupplier(selected)); setShowEdit(true); setShowCreate(false); setShowImport(false); setMessage(null);
  }

  const supplierForm = (value: Draft, update: <K extends keyof Draft>(key: K, value: Draft[K]) => void) => <>
    <div className="grid grid-2"><label>Nombre comercial *<input className="input" required value={value.name} onChange={(event) => update("name", event.target.value)} /></label><label>Categoría<input className="input" placeholder="Hotel, aerolínea, DMC, seguro..." value={value.category} onChange={(event) => update("category", event.target.value)} /></label></div>
    <div className="grid grid-2"><label>Email<input className="input" type="email" value={value.email} onChange={(event) => update("email", event.target.value)} /></label><label>Teléfono<input className="input" type="tel" value={value.phone} onChange={(event) => update("phone", event.target.value)} /></label></div>
    <div className="grid grid-2"><label>NIF / ID fiscal<input className="input" value={value.tax_id} onChange={(event) => update("tax_id", event.target.value)} /></label><label>País<input className="input" maxLength={2} value={value.country} onChange={(event) => update("country", event.target.value)} /></label></div>
    <label>Margen predeterminado (%)<input className="input" type="number" min="0" max="99" step="0.1" value={value.default_margin_pct} onChange={(event) => update("default_margin_pct", event.target.value)} placeholder="Usar margen global" /><small>Se aplicará automáticamente a las nuevas líneas de este proveedor, salvo que indiques otro margen en el presupuesto.</small></label>
    <label>Dirección fiscal<input className="input" value={value.billing_address} onChange={(event) => update("billing_address", event.target.value)} /></label>
    <label>Notas internas<textarea className="input" rows={4} value={value.notes} onChange={(event) => update("notes", event.target.value)} /></label>
    <label><input type="checkbox" checked={value.active} onChange={(event) => update("active", event.target.checked)} /> Proveedor activo y seleccionable</label>
  </>;

  return <div className="clients-page">
    <section className="client-kpis">
      <div className="kpi-card"><span className="kpi-icon">P</span><span className="kpi-copy"><strong>Proveedores</strong><b>{stats.total}</b><small>{stats.active} activos</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">H</span><span className="kpi-copy"><strong>Vinculados a Holded</strong><b>{stats.linkedToHolded}</b><small>{stats.fiscalComplete} con fiscal completo</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">!</span><span className="kpi-copy"><strong>Compras pendientes</strong><b>{stats.pendingPurchases}</b><small>Por cerrar o revisar</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">€</span><span className="kpi-copy"><strong>Coste aprobado</strong><b>{money(stats.approvedTotal)}</b><small>Presupuestado {money(stats.expectedTotal)}</small></span></div>
    </section>

    <section className="clients-layout">
      <div className="card clients-main" id="proveedores-listado">
        <form className="client-filters client-filters-wide" onSubmit={submitSearch}>
          <input className="input" placeholder="Buscar en todos los proveedores por nombre, categoría, email, teléfono o NIF..." value={queryInput} onChange={(event) => setQueryInput(event.target.value)} />
          <label>Estado<select value={status} onChange={(event) => void changeStatus(event.target.value as SupplierPage["status"])} disabled={loading}><option value="active">Activos</option><option value="inactive">Inactivos</option><option value="all">Todos</option></select></label>
          <button className="btn secondary" type="submit" disabled={loading}>{loading ? "Buscando..." : "Buscar"}</button>
          {query ? <button className="btn secondary" type="button" onClick={() => void clearSearch()} disabled={loading}>Limpiar</button> : null}
        </form>

        <div className="form-actions">
          <label>Mostrar <select value={pageSize} onChange={(event) => void loadPage(1, Number(event.target.value), query, status)} disabled={loading}>{pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}</select> proveedores por página</label>
          {canManage ? <><a className="btn secondary" href="/api/routsify/suppliers/import/template">Descargar plantilla</a><button className={showImport ? "btn secondary" : "btn"} type="button" onClick={() => { setShowImport((current) => !current); setShowCreate(false); setShowEdit(false); setMessage(null); }}>{showImport ? "Cerrar importación" : "Importar proveedores"}</button><button className={showCreate ? "btn secondary" : "btn"} type="button" onClick={() => { setShowCreate((current) => !current); setShowImport(false); setShowEdit(false); setDraft(emptyDraft); setMessage(null); }}>{showCreate ? "Cerrar formulario" : "Nuevo proveedor"}</button></> : null}
        </div>

        {showImport && canManage ? <section className="creation-panel"><div className="creation-panel-header"><div><div className="eyebrow">Importación de proveedores</div><h2>Plantilla CSV compatible con Excel</h2><p>Importa hasta 2.000 proveedores. Los duplicados por nombre, NIF o email se omiten sin alterar el historial existente.</p></div><button className="btn secondary" type="button" onClick={() => setShowImport(false)} disabled={importing}>Cerrar</button></div><form className="form" onSubmit={importSuppliers}><label>Archivo CSV<input className="input" type="file" accept=".csv,text/csv" onChange={(event) => setImportFile(event.target.files?.[0] || null)} /></label><div className="form-actions"><a className="btn secondary" href="/api/routsify/suppliers/import/template">Descargar plantilla vacía</a><button className="btn" type="submit" disabled={importing || !importFile}>{importing ? "Importando..." : "Importar proveedores"}</button></div></form>{importSummary ? <div className="client-message"><strong>Resultado:</strong> {importSummary.imported} importados · {importSummary.duplicates} duplicados omitidos · {importSummary.invalid} con errores.{importSummary.errors.length ? <details><summary>Ver errores de filas</summary><ul>{importSummary.errors.slice(0, 20).map((error) => <li key={`${error.row}-${error.message}`}>Fila {error.row}: {error.message}</li>)}</ul></details> : null}</div> : null}</section> : null}

        {showCreate && canManage ? <section className="creation-panel"><div className="creation-panel-header"><div><div className="eyebrow">Nuevo proveedor</div><h2>Contacto y datos fiscales</h2><p>El proveedor quedará disponible para presupuestos, compras, facturas e integración con Holded.</p></div><button className="btn secondary" type="button" onClick={() => setShowCreate(false)} disabled={saving}>Cancelar</button></div><form className="form" onSubmit={(event) => saveSupplier(event, false)}>{supplierForm(draft, changeDraft)}<div className="form-actions"><button className="btn secondary" type="button" onClick={() => setShowCreate(false)} disabled={saving}>Cancelar</button><button className="btn" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar proveedor"}</button></div></form></section> : null}

        {!canManage ? <p className="client-message" role="status">Modo consulta: tu rol puede revisar proveedores, pero no crear, importar ni modificar sus datos.</p> : null}
        {message ? <p className="client-message" role="status">{message}</p> : null}
        {loading ? <p className="client-message" role="status">Cargando proveedores...</p> : null}

        {items.length === 0 ? <div className="empty-state"><h2>{query ? "No hay coincidencias" : "Todavía no hay proveedores"}</h2><p>{query ? "Cambia la búsqueda o límpiala." : canManage ? "Crea o importa tu primer proveedor." : "No hay proveedores disponibles para consultar."}</p></div> : <div className="table-scroll"><table><thead><tr><th>Proveedor</th><th>Categoría</th><th>Contacto</th><th>Compras</th><th>Pendientes</th><th>Coste real</th><th>Holded</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className={item.id === selected?.id ? "selected-row" : ""}><td><button className="table-link" type="button" onClick={() => { setSelectedId(item.id); setShowEdit(false); }}><strong>{item.name}</strong><br /><small>{item.active === false ? "Inactivo" : item.country || "Sin país"}</small></button></td><td>{item.category || "—"}</td><td>{item.email || item.phone || "—"}</td><td>{item.purchase_count || 0}</td><td>{item.pending_count || 0}</td><td>{money(item.approved_total)}</td><td>{item.holded_contact_id ? "Vinculado" : "Pendiente"}</td></tr>)}</tbody></table></div>}

        <div className="form-actions" aria-label="Paginación de proveedores">
          <span>Mostrando {rangeStart}-{rangeEnd} de {total}{query ? " coincidencias" : " proveedores"}</span>
          <button className="btn secondary" type="button" onClick={() => void loadPage(1)} disabled={loading || page <= 1}>Primera</button>
          <button className="btn secondary" type="button" onClick={() => void loadPage(page - 1)} disabled={loading || page <= 1}>Anterior</button>
          <strong>Página {page} de {totalPages}</strong>
          <button className="btn secondary" type="button" onClick={() => void loadPage(page + 1)} disabled={loading || page >= totalPages}>Siguiente</button>
          <button className="btn secondary" type="button" onClick={() => void loadPage(totalPages)} disabled={loading || page >= totalPages}>Última</button>
        </div>
      </div>

      <aside className="client-side card" id="proveedor-panel">
        {selected ? <>{showEdit && canManage ? <section className="side-section"><div className="section-heading"><h3>Editar proveedor</h3><button className="link-button" type="button" onClick={() => setShowEdit(false)}>Cerrar</button></div><form className="form" onSubmit={(event) => saveSupplier(event, true)}>{supplierForm(editDraft, changeEditDraft)}<div className="form-actions"><button className="btn secondary" type="button" onClick={() => setShowEdit(false)} disabled={saving}>Cancelar</button><button className="btn" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</button></div></form></section> : <><div className="client-side-header"><span className="client-avatar">{supplierInitials(selected)}</span><div><h2>{selected.name}</h2><p>{selected.category || "Sin categoría"}<br />{selected.active === false ? "Inactivo" : "Activo"}</p></div></div><div className="client-badges"><span className="badge">Proveedor</span><span className="badge">{selected.holded_contact_id ? "Holded vinculado" : "Holded pendiente"}</span></div><section className="side-section"><div className="section-heading"><h3>Contacto y fiscal</h3>{canManage ? <button className="link-button" type="button" onClick={startEdit}>Editar</button> : null}</div><table><tbody><tr><th>Email</th><td>{selected.email || "—"}</td></tr><tr><th>Teléfono</th><td>{selected.phone || "—"}</td></tr><tr><th>País</th><td>{selected.country || "—"}</td></tr><tr><th>NIF / ID fiscal</th><td>{selected.tax_id || "Pendiente"}</td></tr><tr><th>Dirección fiscal</th><td>{billingAddressText(selected.billing_address)}</td></tr><tr><th>Margen predeterminado</th><td>{selected.default_margin_pct === null || selected.default_margin_pct === undefined ? "Global" : `${selected.default_margin_pct}%`}</td></tr></tbody></table></section><section className="side-section"><h3>Histórico económico</h3><table><tbody><tr><th>Compras</th><td>{selected.purchase_count || 0}</td></tr><tr><th>Pendientes</th><td>{selected.pending_count || 0}</td></tr><tr><th>Coste presupuestado</th><td>{money(selected.expected_total)}</td></tr><tr><th>Coste real aprobado</th><td>{money(selected.approved_total)}</td></tr><tr><th>Facturado registrado</th><td>{money(selected.invoiced_total)}</td></tr></tbody></table></section><section className="side-section"><h3>Notas</h3><p>{selected.notes || "Sin notas internas."}</p></section><section className="side-actions"><h3>Acciones</h3><a className="quick-action primary" href={`/compras?supplierId=${encodeURIComponent(selected.id)}`}>Ver compras y facturas <span>→</span></a>{canManage ? <button className="quick-action" type="button" onClick={startEdit}>Editar proveedor <span>→</span></button> : null}{canManage ? <button className="quick-action" type="button" disabled={saving} onClick={() => void toggleActive()}>{selected.active === false ? "Reactivar proveedor" : "Desactivar proveedor"} <span>→</span></button> : null}</section></>}</> : <div className="empty-state"><h2>Sin proveedor seleccionado</h2><p>Selecciona un proveedor.</p></div>}
      </aside>
    </section>
  </div>;
}
