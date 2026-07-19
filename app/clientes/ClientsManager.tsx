"use client";

import { FormEvent, useState } from "react";
import { usePermission } from "@/components/PermissionProvider";
import type { Client } from "@/lib/types";

type ClientRow = Client & { created_at?: string | null; updated_at?: string | null };
type Draft = {
  display_name: string;
  email: string;
  phone: string;
  client_type: string;
  tax_id: string;
  billing_address: string;
  country: string;
  notes: string;
};
type ClientStats = { total: number; withEmail: number; withPhone: number; fiscalComplete: number };
type ClientPage = {
  items: unknown[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query: string;
  stats: ClientStats;
};
type ImportSummary = {
  totalRows: number;
  imported: number;
  duplicates: number;
  invalid: number;
  errors: Array<{ row: number; message: string }>;
};

const emptyDraft: Draft = { display_name: "", email: "", phone: "", client_type: "person", tax_id: "", billing_address: "", country: "ES", notes: "" };
const pageSizes = [50, 100, 150, 200];

function normalizeClient(input: unknown): ClientRow {
  const row = input as Record<string, unknown>;
  return {
    id: String(row.id || crypto.randomUUID()),
    display_name: String(row.display_name || row.name || "Cliente sin nombre"),
    client_type: String(row.client_type || "person"),
    email: row.email ? String(row.email) : null,
    email_normalized: row.email_normalized ? String(row.email_normalized) : null,
    phone: row.phone ? String(row.phone) : null,
    phone_normalized: row.phone_normalized ? String(row.phone_normalized) : null,
    tax_id: row.tax_id ? String(row.tax_id) : null,
    billing_address: row.billing_address || null,
    country: row.country ? String(row.country) : "ES",
    language: row.language ? String(row.language) : "es",
    source: row.source ? String(row.source) : "manual",
    holded_contact_id: row.holded_contact_id ? String(row.holded_contact_id) : null,
    notes: row.notes ? String(row.notes) : null,
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
  };
}

function billingAddressText(value: unknown) {
  if (!value) return "—";
  if (typeof value === "string") return value || "—";
  if (typeof value === "object" && value && "address" in value) return String((value as { address?: unknown }).address || "—");
  return "—";
}

function draftFromClient(client: ClientRow): Draft {
  return {
    display_name: client.display_name || "",
    email: client.email || "",
    phone: client.phone || "",
    client_type: client.client_type || "person",
    tax_id: client.tax_id || "",
    billing_address: billingAddressText(client.billing_address) === "—" ? "" : billingAddressText(client.billing_address),
    country: client.country || "ES",
    notes: client.notes || "",
  };
}

function clientInitials(client?: ClientRow) {
  if (!client?.display_name) return "--";
  return client.display_name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function apiErrorMessage(result: unknown, action: "create" | "update") {
  const error = String((result as { error?: unknown } | null)?.error || "");
  if (error.includes("duplicate") || error.includes("unique") || error === "client_already_exists") return "Ya existe un cliente con ese email o teléfono.";
  if (error === "invalid_email") return "El email no tiene un formato válido.";
  if (error === "invalid_country") return "El país debe indicarse con dos letras, por ejemplo ES.";
  if (error === "client_name_required") return "Introduce el nombre del cliente.";
  return action === "create" ? "No se pudo crear el cliente." : "No se pudieron guardar los cambios.";
}

function importErrorMessage(result: unknown) {
  const error = String((result as { error?: unknown } | null)?.error || "");
  if (error === "import_file_required") return "Selecciona un archivo CSV.";
  if (error === "import_csv_required") return "La importación requiere un archivo CSV basado en la plantilla.";
  if (error === "import_file_too_large") return "El archivo supera el máximo permitido de 5 MB.";
  if (error === "empty_import_file") return "El archivo está vacío.";
  if (error === "import_file_has_no_rows") return "La plantilla no contiene clientes para importar.";
  if (error === "import_name_column_required") return "No se encuentra la columna nombre en la plantilla.";
  if (error === "import_row_limit_exceeded") return "Puedes importar un máximo de 2.000 clientes por archivo.";
  return "No se pudo completar la importación.";
}

export function ClientsManager({ initialPage }: { initialPage: ClientPage }) {
  const canManage = usePermission("clients.manage");
  const canManageCases = usePermission("cases.manage");
  const [clients, setClients] = useState<ClientRow[]>(() => initialPage.items.map(normalizeClient));
  const [selectedId, setSelectedId] = useState<string | null>(() => clients[0]?.id || null);
  const [page, setPage] = useState(initialPage.page);
  const [pageSize, setPageSize] = useState(initialPage.pageSize);
  const [total, setTotal] = useState(initialPage.total);
  const [totalPages, setTotalPages] = useState(initialPage.totalPages);
  const [stats, setStats] = useState<ClientStats>(initialPage.stats);
  const [queryInput, setQueryInput] = useState(initialPage.query || "");
  const [query, setQuery] = useState(initialPage.query || "");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const selected = clients.find((client) => client.id === selectedId) || clients[0] || null;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  function updateEditDraft<K extends keyof Draft>(key: K, value: Draft[K]) { setEditDraft((current) => ({ ...current, [key]: value })); }
  function closeCreate() { if (!saving) { setShowCreate(false); setDraft(emptyDraft); } }
  function startEdit() { if (canManage && selected) { setEditDraft(draftFromClient(selected)); setShowEdit(true); setMessage(null); } }

  async function loadPage(nextPage: number, nextPageSize = pageSize, nextQuery = query) {
    setLoading(true);
    const params = new URLSearchParams({ paginated: "1", page: String(nextPage), pageSize: String(nextPageSize) });
    if (nextQuery) params.set("q", nextQuery);
    const response = await fetch(`/api/routsify/clients?${params.toString()}`, { cache: "no-store" });
    const result = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok || !result?.ok || !result?.data) {
      setMessage("No se pudo cargar la página de clientes.");
      return false;
    }
    const data = result.data as ClientPage;
    const rows = data.items.map(normalizeClient);
    setClients(rows);
    setPage(data.page);
    setPageSize(data.pageSize);
    setTotal(data.total);
    setTotalPages(data.totalPages);
    setStats(data.stats);
    setSelectedId(rows[0]?.id || null);
    setShowEdit(false);
    return true;
  }

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = queryInput.trim();
    setQuery(nextQuery);
    await loadPage(1, pageSize, nextQuery);
  }

  async function clearSearch() {
    setQueryInput("");
    setQuery("");
    await loadPage(1, pageSize, "");
  }

  async function changePageSize(value: number) {
    await loadPage(1, value, query);
  }

  async function createClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return setMessage("Tu rol tiene acceso de consulta a clientes.");
    const displayName = draft.display_name.trim();
    if (!displayName) return setMessage("Introduce el nombre del cliente.");
    setSaving(true); setMessage(null);
    const response = await fetch("/api/routsify/clients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        display_name: displayName,
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
        client_type: draft.client_type,
        tax_id: draft.tax_id.trim() || null,
        billing_address: draft.billing_address.trim() ? { address: draft.billing_address.trim() } : {},
        country: draft.country.trim().toUpperCase() || "ES",
        notes: draft.notes.trim() || null,
        source: "manual",
      }),
    });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok || !result?.ok) return setMessage(apiErrorMessage(result, "create"));
    setDraft(emptyDraft); setShowCreate(false); setQueryInput(""); setQuery("");
    await loadPage(1, pageSize, "");
    setMessage("Cliente creado correctamente.");
  }

  async function saveClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return setMessage("Tu rol tiene acceso de consulta a clientes.");
    if (!selected) return;
    if (!editDraft.display_name.trim()) return setMessage("Introduce el nombre del cliente.");
    setSaving(true); setMessage(null);
    const response = await fetch(`/api/routsify/clients/${encodeURIComponent(selected.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        display_name: editDraft.display_name.trim(),
        email: editDraft.email.trim() || null,
        phone: editDraft.phone.trim() || null,
        client_type: editDraft.client_type,
        tax_id: editDraft.tax_id.trim() || null,
        billing_address: editDraft.billing_address.trim() ? { address: editDraft.billing_address.trim() } : {},
        country: editDraft.country.trim().toUpperCase() || "ES",
        notes: editDraft.notes.trim() || null,
      }),
    });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok || !result?.ok) return setMessage(apiErrorMessage(result, "update"));
    const updated = normalizeClient(result.data);
    setClients((current) => current.map((client) => client.id === updated.id ? updated : client));
    setSelectedId(updated.id); setShowEdit(false); setMessage("Cliente actualizado correctamente.");
  }

  async function importClients(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return setMessage("Tu rol tiene acceso de consulta a clientes.");
    if (!importFile) return setMessage("Selecciona el archivo CSV completado.");
    setImporting(true); setMessage(null); setImportSummary(null);
    const form = new FormData();
    form.set("file", importFile);
    const response = await fetch("/api/routsify/clients/import", { method: "POST", body: form });
    const result = await response.json().catch(() => null);
    setImporting(false);
    if (!response.ok || !result?.ok) return setMessage(importErrorMessage(result));
    const summary = result.data as ImportSummary;
    setImportSummary(summary);
    setImportFile(null);
    setQueryInput(""); setQuery("");
    await loadPage(1, pageSize, "");
    setMessage(`Importación terminada: ${summary.imported} clientes creados, ${summary.duplicates} duplicados omitidos y ${summary.invalid} filas con errores.`);
  }

  const clientForm = (value: Draft, update: <K extends keyof Draft>(key: K, value: Draft[K]) => void) => <>
    <label>Nombre o razón social *<input className="input" required autoComplete="name" value={value.display_name} onChange={(event) => update("display_name", event.target.value)} /></label>
    <div className="grid grid-2"><label>Email<input className="input" type="email" autoComplete="email" value={value.email} onChange={(event) => update("email", event.target.value)} /></label><label>Teléfono<input className="input" type="tel" autoComplete="tel" value={value.phone} onChange={(event) => update("phone", event.target.value)} /></label></div>
    <div className="grid grid-2"><label>Tipo<select value={value.client_type} onChange={(event) => update("client_type", event.target.value)}><option value="person">Persona</option><option value="company">Empresa</option></select></label><label>País<input className="input" maxLength={2} value={value.country} onChange={(event) => update("country", event.target.value)} /></label></div>
    <div className="grid grid-2"><label>NIF / DNI / CIF<input className="input" value={value.tax_id} onChange={(event) => update("tax_id", event.target.value)} /></label><label>Dirección fiscal<input className="input" autoComplete="street-address" value={value.billing_address} onChange={(event) => update("billing_address", event.target.value)} /></label></div>
    <label>Notas internas<textarea className="input" value={value.notes} onChange={(event) => update("notes", event.target.value)} rows={3} /></label>
  </>;

  return <div className="clients-page">
    <section className="client-kpis">
      <div className="kpi-card"><span className="kpi-icon">C</span><span className="kpi-copy"><strong>Clientes</strong><b>{stats.total}</b><small>Total registrados</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">@</span><span className="kpi-copy"><strong>Con email</strong><b>{stats.withEmail}</b><small>Contacto disponible</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">☎</span><span className="kpi-copy"><strong>Con teléfono</strong><b>{stats.withPhone}</b><small>Seguimiento directo</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">F</span><span className="kpi-copy"><strong>Fiscal completo</strong><b>{stats.fiscalComplete}</b><small>NIF y dirección</small></span></div>
    </section>

    <section className="clients-layout">
      <div className="card clients-main" id="clientes-listado">
        <form className="client-filters client-filters-simple" onSubmit={submitSearch}>
          <input className="input" placeholder="Buscar en todos los clientes por nombre, email, teléfono o NIF..." value={queryInput} onChange={(event) => setQueryInput(event.target.value)} />
          <button className="btn secondary" type="submit" disabled={loading}>{loading ? "Buscando..." : "Buscar"}</button>
          {query ? <button className="btn secondary" type="button" onClick={clearSearch} disabled={loading}>Limpiar</button> : null}
        </form>

        <div className="form-actions">
          <label>Mostrar <select value={pageSize} onChange={(event) => changePageSize(Number(event.target.value))} disabled={loading}>{pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}</select> clientes por página</label>
          {canManage ? <><a className="btn secondary" href="/api/routsify/clients/import/template">Descargar plantilla</a><button className={showImport ? "btn secondary" : "btn"} type="button" onClick={() => { setShowImport((current) => !current); setShowCreate(false); setMessage(null); }}>{showImport ? "Cerrar importación" : "Importar clientes"}</button><button className={showCreate ? "btn secondary" : "btn"} type="button" onClick={() => { setShowCreate((current) => !current); setShowImport(false); setMessage(null); }} aria-expanded={showCreate}>{showCreate ? "Cerrar formulario" : "Nuevo cliente"}</button></> : null}
        </div>

        {showImport && canManage ? <section className="creation-panel"><div className="creation-panel-header"><div><div className="eyebrow">Importación de clientes</div><h2>Plantilla CSV compatible con Excel</h2><p>Descarga la plantilla, completa una fila por cliente y guárdala como CSV. Se admiten hasta 2.000 filas. Los clientes que ya existan por email o teléfono se omitirán sin duplicarlos.</p></div><button className="btn secondary" type="button" onClick={() => setShowImport(false)} disabled={importing}>Cerrar</button></div><form className="form" onSubmit={importClients}><label>Archivo CSV<input className="input" type="file" accept=".csv,text/csv" onChange={(event) => setImportFile(event.target.files?.[0] || null)} /></label><div className="form-actions"><a className="btn secondary" href="/api/routsify/clients/import/template">Descargar plantilla vacía</a><button className="btn" type="submit" disabled={importing || !importFile}>{importing ? "Importando..." : "Importar clientes"}</button></div></form>{importSummary ? <div className="client-message"><strong>Resultado:</strong> {importSummary.imported} importados · {importSummary.duplicates} duplicados omitidos · {importSummary.invalid} con errores.{importSummary.errors.length ? <details><summary>Ver errores de filas</summary><ul>{importSummary.errors.slice(0, 20).map((error) => <li key={`${error.row}-${error.message}`}>Fila {error.row}: {error.message}</li>)}</ul></details> : null}</div> : null}</section> : null}

        {showCreate && canManage ? <section className="creation-panel"><div className="creation-panel-header"><div><div className="eyebrow">Nuevo cliente</div><h2>Datos básicos y fiscales</h2><p>Guarda los datos disponibles; podrás completarlos después.</p></div><button className="btn secondary" type="button" onClick={closeCreate} disabled={saving}>Cancelar</button></div><form className="form" onSubmit={createClient}>{clientForm(draft, updateDraft)}<div className="form-actions"><button className="btn secondary" type="button" onClick={closeCreate} disabled={saving}>Cancelar</button><button className="btn" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar cliente"}</button></div></form></section> : null}
        {!canManage ? <p className="client-message" role="status">Modo consulta: tu rol puede revisar clientes, pero no crear, importar ni modificar sus datos.</p> : null}
        {message ? <p className="client-message" role="status">{message}</p> : null}
        {loading ? <p className="client-message" role="status">Cargando clientes...</p> : null}

        {clients.length === 0 ? <div className="empty-state"><h2>{query ? "No hay coincidencias" : "Todavía no hay clientes"}</h2><p>{query ? "Cambia la búsqueda o límpiala." : canManage ? "Crea o importa tu primer cliente para empezar." : "No hay clientes disponibles para consultar."}</p></div> : <div className="table-scroll"><table><thead><tr><th>Cliente</th><th>Email</th><th>Teléfono</th><th>País</th><th>Fiscal</th><th></th></tr></thead><tbody>{clients.map((client) => <tr key={client.id} className={client.id === selected?.id ? "selected-row" : ""}><td><button className="table-link" type="button" onClick={() => { setSelectedId(client.id); setShowEdit(false); }}><strong>{client.display_name}</strong></button></td><td>{client.email || "—"}</td><td>{client.phone || "—"}</td><td>{client.country || "—"}</td><td>{client.tax_id && billingAddressText(client.billing_address) !== "—" ? "Completo" : "Pendiente"}</td><td><a className="btn secondary" href={`/clientes/${encodeURIComponent(client.id)}`}>Ficha 360</a></td></tr>)}</tbody></table></div>}

        <div className="form-actions" aria-label="Paginación de clientes">
          <span>Mostrando {rangeStart}-{rangeEnd} de {total}{query ? " coincidencias" : " clientes"}</span>
          <button className="btn secondary" type="button" onClick={() => loadPage(1)} disabled={loading || page <= 1}>Primera</button>
          <button className="btn secondary" type="button" onClick={() => loadPage(page - 1)} disabled={loading || page <= 1}>Anterior</button>
          <strong>Página {page} de {totalPages}</strong>
          <button className="btn secondary" type="button" onClick={() => loadPage(page + 1)} disabled={loading || page >= totalPages}>Siguiente</button>
          <button className="btn secondary" type="button" onClick={() => loadPage(totalPages)} disabled={loading || page >= totalPages}>Última</button>
        </div>
      </div>

      <aside className="client-side card" id="cliente-panel">
        {selected ? <>{showEdit && canManage ? <section className="side-section"><div className="section-heading"><h3>Editar cliente</h3><button className="link-button" type="button" onClick={() => setShowEdit(false)}>Cerrar</button></div><form className="form" onSubmit={saveClient}>{clientForm(editDraft, updateEditDraft)}<div className="form-actions"><button className="btn secondary" type="button" onClick={() => setShowEdit(false)} disabled={saving}>Cancelar</button><button className="btn" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</button></div></form></section> : <><div className="client-side-header"><span className="client-avatar">{clientInitials(selected)}</span><div><h2>{selected.display_name}</h2><p>{selected.email || "Sin email"}<br />{selected.phone || "Sin teléfono"}</p></div></div><div className="client-badges"><span className="badge">Cliente</span><span className="badge">{selected.client_type === "company" ? "Empresa" : "Persona"}</span></div><section className="side-section"><div className="section-heading"><h3>Datos fiscales</h3>{canManage ? <button className="link-button" type="button" onClick={startEdit}>Editar</button> : null}</div><table><tbody><tr><th>NIF/DNI/CIF</th><td>{selected.tax_id || "Pendiente"}</td></tr><tr><th>Dirección fiscal</th><td>{billingAddressText(selected.billing_address)}</td></tr><tr><th>País</th><td>{selected.country || "—"}</td></tr></tbody></table></section><section className="side-section"><h3>Notas</h3><p>{selected.notes || "Sin notas internas."}</p></section><section className="side-actions"><h3>Acciones</h3><a className="quick-action primary" href={`/clientes/${encodeURIComponent(selected.id)}`}>Abrir ficha 360 <span>→</span></a>{canManage ? <button className="quick-action" type="button" onClick={startEdit}>Editar cliente <span>→</span></button> : null}{canManageCases ? <a className="quick-action" href={`/expedientes?clientId=${encodeURIComponent(selected.id)}`}>Crear expediente <span>→</span></a> : null}<a className="quick-action" href={`/propuestas?clientId=${encodeURIComponent(selected.id)}`}>Ver presupuestos <span>→</span></a></section></>}</> : <div className="empty-state"><h2>Sin cliente seleccionado</h2><p>Selecciona un cliente.</p></div>}
      </aside>
    </section>
  </div>;
}
