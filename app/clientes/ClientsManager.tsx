"use client";

import { FormEvent, useMemo, useState } from "react";
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

const emptyDraft: Draft = { display_name: "", email: "", phone: "", client_type: "person", tax_id: "", billing_address: "", country: "ES", notes: "" };

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
  if (error.includes("duplicate") || error.includes("unique")) return "Ya existe un cliente con ese email.";
  if (error === "invalid_email") return "El email no tiene un formato válido.";
  if (error === "invalid_country") return "El país debe indicarse con dos letras, por ejemplo ES.";
  if (error === "client_name_required") return "Introduce el nombre del cliente.";
  return action === "create" ? "No se pudo crear el cliente." : "No se pudieron guardar los cambios.";
}

export function ClientsManager({ initialClients = [] }: { initialClients?: unknown[] }) {
  const canManage = usePermission("clients.manage");
  const canManageCases = usePermission("cases.manage");
  const [clients, setClients] = useState<ClientRow[]>(() => initialClients.map(normalizeClient));
  const [selectedId, setSelectedId] = useState<string | null>(() => clients[0]?.id || null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((client) => [client.display_name, client.email, client.phone, client.tax_id, client.country].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [clients, query]);

  const selected = clients.find((client) => client.id === selectedId) || filtered[0] || clients[0] || null;
  const fiscalComplete = clients.filter((client) => client.tax_id && billingAddressText(client.billing_address) !== "—").length;
  const withEmail = clients.filter((client) => client.email).length;
  const withPhone = clients.filter((client) => client.phone).length;

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  function updateEditDraft<K extends keyof Draft>(key: K, value: Draft[K]) { setEditDraft((current) => ({ ...current, [key]: value })); }
  function closeCreate() { if (!saving) { setShowCreate(false); setDraft(emptyDraft); } }
  function startEdit() { if (canManage && selected) { setEditDraft(draftFromClient(selected)); setShowEdit(true); setMessage(null); } }

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
    const created = normalizeClient(result.data);
    setClients((current) => [created, ...current.filter((client) => client.id !== created.id)]);
    setSelectedId(created.id); setDraft(emptyDraft); setShowCreate(false); setMessage("Cliente creado correctamente.");
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

  const clientForm = (value: Draft, update: <K extends keyof Draft>(key: K, value: Draft[K]) => void) => <>
    <label>Nombre o razón social *<input className="input" required autoComplete="name" value={value.display_name} onChange={(event) => update("display_name", event.target.value)} /></label>
    <div className="grid grid-2"><label>Email<input className="input" type="email" autoComplete="email" value={value.email} onChange={(event) => update("email", event.target.value)} /></label><label>Teléfono<input className="input" type="tel" autoComplete="tel" value={value.phone} onChange={(event) => update("phone", event.target.value)} /></label></div>
    <div className="grid grid-2"><label>Tipo<select value={value.client_type} onChange={(event) => update("client_type", event.target.value)}><option value="person">Persona</option><option value="company">Empresa</option></select></label><label>País<input className="input" maxLength={2} value={value.country} onChange={(event) => update("country", event.target.value)} /></label></div>
    <div className="grid grid-2"><label>NIF / DNI / CIF<input className="input" value={value.tax_id} onChange={(event) => update("tax_id", event.target.value)} /></label><label>Dirección fiscal<input className="input" autoComplete="street-address" value={value.billing_address} onChange={(event) => update("billing_address", event.target.value)} /></label></div>
    <label>Notas internas<textarea className="input" value={value.notes} onChange={(event) => update("notes", event.target.value)} rows={3} /></label>
  </>;

  return <div className="clients-page">
    <section className="client-kpis">
      <div className="kpi-card"><span className="kpi-icon">C</span><span className="kpi-copy"><strong>Clientes</strong><b>{clients.length}</b><small>Total registrados</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">@</span><span className="kpi-copy"><strong>Con email</strong><b>{withEmail}</b><small>Contacto disponible</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">☎</span><span className="kpi-copy"><strong>Con teléfono</strong><b>{withPhone}</b><small>Seguimiento directo</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">F</span><span className="kpi-copy"><strong>Fiscal completo</strong><b>{fiscalComplete}</b><small>NIF y dirección</small></span></div>
    </section>

    <section className="clients-layout">
      <div className="card clients-main" id="clientes-listado">
        <div className="client-filters client-filters-simple">
          <input className="input" placeholder="Buscar por nombre, email, teléfono o NIF..." value={query} onChange={(event) => setQuery(event.target.value)} />
          {canManage ? <button className={showCreate ? "btn secondary" : "btn"} type="button" onClick={() => setShowCreate((current) => !current)} aria-expanded={showCreate}>{showCreate ? "Cerrar formulario" : "Nuevo cliente"}</button> : null}
        </div>
        {showCreate && canManage ? <section className="creation-panel"><div className="creation-panel-header"><div><div className="eyebrow">Nuevo cliente</div><h2>Datos básicos y fiscales</h2><p>Guarda los datos disponibles; podrás completarlos después.</p></div><button className="btn secondary" type="button" onClick={closeCreate} disabled={saving}>Cancelar</button></div><form className="form" onSubmit={createClient}>{clientForm(draft, updateDraft)}<div className="form-actions"><button className="btn secondary" type="button" onClick={closeCreate} disabled={saving}>Cancelar</button><button className="btn" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar cliente"}</button></div></form></section> : null}
        {!canManage ? <p className="client-message" role="status">Modo consulta: tu rol puede revisar clientes, pero no crear ni modificar sus datos.</p> : null}
        {message ? <p className="client-message" role="status">{message}</p> : null}
        {clients.length === 0 ? <div className="empty-state"><h2>Todavía no hay clientes</h2><p>{canManage ? "Crea tu primer cliente para empezar." : "No hay clientes disponibles para consultar."}</p></div> : filtered.length === 0 ? <div className="empty-state"><h2>No hay coincidencias</h2><p>Cambia la búsqueda.</p></div> : <div className="table-scroll"><table><thead><tr><th>Cliente</th><th>Email</th><th>Teléfono</th><th>País</th><th>Fiscal</th><th></th></tr></thead><tbody>{filtered.map((client) => <tr key={client.id} className={client.id === selected?.id ? "selected-row" : ""}><td><button className="table-link" type="button" onClick={() => { setSelectedId(client.id); setShowEdit(false); }}><strong>{client.display_name}</strong></button></td><td>{client.email || "—"}</td><td>{client.phone || "—"}</td><td>{client.country || "—"}</td><td>{client.tax_id && billingAddressText(client.billing_address) !== "—" ? "Completo" : "Pendiente"}</td><td><a className="btn secondary" href={`/clientes/${encodeURIComponent(client.id)}`}>Ficha 360</a></td></tr>)}</tbody></table></div>}
      </div>

      <aside className="client-side card" id="cliente-panel">
        {selected ? <>{showEdit && canManage ? <section className="side-section"><div className="section-heading"><h3>Editar cliente</h3><button className="link-button" type="button" onClick={() => setShowEdit(false)}>Cerrar</button></div><form className="form" onSubmit={saveClient}>{clientForm(editDraft, updateEditDraft)}<div className="form-actions"><button className="btn secondary" type="button" onClick={() => setShowEdit(false)} disabled={saving}>Cancelar</button><button className="btn" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</button></div></form></section> : <><div className="client-side-header"><span className="client-avatar">{clientInitials(selected)}</span><div><h2>{selected.display_name}</h2><p>{selected.email || "Sin email"}<br />{selected.phone || "Sin teléfono"}</p></div></div><div className="client-badges"><span className="badge">Cliente</span><span className="badge">{selected.client_type === "company" ? "Empresa" : "Persona"}</span></div><section className="side-section"><div className="section-heading"><h3>Datos fiscales</h3>{canManage ? <button className="link-button" type="button" onClick={startEdit}>Editar</button> : null}</div><table><tbody><tr><th>NIF/DNI/CIF</th><td>{selected.tax_id || "Pendiente"}</td></tr><tr><th>Dirección fiscal</th><td>{billingAddressText(selected.billing_address)}</td></tr><tr><th>País</th><td>{selected.country || "—"}</td></tr></tbody></table></section><section className="side-section"><h3>Notas</h3><p>{selected.notes || "Sin notas internas."}</p></section><section className="side-actions"><h3>Acciones</h3><a className="quick-action primary" href={`/clientes/${encodeURIComponent(selected.id)}`}>Abrir ficha 360 <span>→</span></a>{canManage ? <button className="quick-action" type="button" onClick={startEdit}>Editar cliente <span>→</span></button> : null}{canManageCases ? <a className="quick-action" href={`/expedientes?clientId=${encodeURIComponent(selected.id)}`}>Crear expediente <span>→</span></a> : null}<a className="quick-action" href={`/propuestas?clientId=${encodeURIComponent(selected.id)}`}>Ver presupuestos <span>→</span></a></section></>}</> : <div className="empty-state"><h2>Sin cliente seleccionado</h2><p>Selecciona un cliente.</p></div>}
      </aside>
    </section>
  </div>;
}
