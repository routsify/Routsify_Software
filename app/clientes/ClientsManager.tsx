"use client";

import { FormEvent, useMemo, useState } from "react";
import type { Client } from "@/lib/types";

type ClientRow = Client & {
  created_at?: string | null;
  updated_at?: string | null;
};

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

const emptyDraft: Draft = {
  display_name: "",
  email: "",
  phone: "",
  client_type: "person",
  tax_id: "",
  billing_address: "",
  country: "ES",
  notes: "",
};

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

function clientInitials(client?: ClientRow) {
  if (!client?.display_name) return "--";
  return client.display_name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function ClientsManager({ initialClients = [] }: { initialClients?: unknown[] }) {
  const [clients, setClients] = useState<ClientRow[]>(() => initialClients.map(normalizeClient));
  const [selectedId, setSelectedId] = useState<string | null>(() => clients[0]?.id || null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
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

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function createClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayName = draft.display_name.trim();
    if (!displayName) {
      setMessage("Introduce el nombre del cliente.");
      return;
    }

    setSaving(true);
    setMessage(null);

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
        country: draft.country.trim() || "ES",
        notes: draft.notes.trim() || null,
        source: "manual",
      }),
    });

    const result = await response.json().catch(() => null);
    setSaving(false);

    if (!response.ok || !result?.ok) {
      setMessage("No se pudo crear el cliente. Revisa los datos e inténtalo de nuevo.");
      return;
    }

    const created = normalizeClient(result.data);
    setClients((current) => [created, ...current.filter((client) => client.id !== created.id)]);
    setSelectedId(created.id);
    setDraft(emptyDraft);
    setMessage("Cliente creado correctamente.");
  }

  return (
    <div className="clients-page">
      <section className="client-kpis">
        <div className="kpi-card"><span className="kpi-icon">C</span><span className="kpi-copy"><strong>Clientes</strong><b>{clients.length}</b><small>Total registrados</small></span></div>
        <div className="kpi-card"><span className="kpi-icon">@</span><span className="kpi-copy"><strong>Con email</strong><b>{withEmail}</b><small>Contacto disponible</small></span></div>
        <div className="kpi-card"><span className="kpi-icon">☎</span><span className="kpi-copy"><strong>Con teléfono</strong><b>{withPhone}</b><small>Seguimiento directo</small></span></div>
        <div className="kpi-card"><span className="kpi-icon">F</span><span className="kpi-copy"><strong>Fiscal completo</strong><b>{fiscalComplete}</b><small>NIF y dirección</small></span></div>
      </section>

      <section className="clients-layout">
        <div className="card clients-main" id="clientes-listado">
          <div className="client-filters client-filters-simple">
            <input className="input" placeholder="Buscar cliente..." value={query} onChange={(event) => setQuery(event.target.value)} />
            <details className="new-client-drawer">
              <summary className="btn">Nuevo cliente</summary>
              <form className="form" onSubmit={createClient}>
                <label>Nombre<input className="input" value={draft.display_name} onChange={(event) => updateDraft("display_name", event.target.value)} /></label>
                <div className="grid grid-2"><label>Email<input className="input" type="email" value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} /></label><label>Teléfono<input className="input" value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} /></label></div>
                <div className="grid grid-2"><label>Tipo<select value={draft.client_type} onChange={(event) => updateDraft("client_type", event.target.value)}><option value="person">Persona</option><option value="company">Empresa</option></select></label><label>País<input className="input" value={draft.country} onChange={(event) => updateDraft("country", event.target.value)} /></label></div>
                <div className="grid grid-2"><label>NIF/DNI/CIF<input className="input" value={draft.tax_id} onChange={(event) => updateDraft("tax_id", event.target.value)} /></label><label>Dirección fiscal<input className="input" value={draft.billing_address} onChange={(event) => updateDraft("billing_address", event.target.value)} /></label></div>
                <label>Notas<textarea className="input" value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} rows={3} /></label>
                <button className="btn" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar cliente"}</button>
              </form>
            </details>
          </div>

          {message ? <p className="client-message">{message}</p> : null}

          {clients.length === 0 ? (
            <div className="empty-state"><h2>Todavía no hay clientes</h2><p>Crea tu primer cliente para empezar a trabajar con expedientes y presupuestos.</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><h2>No hay coincidencias</h2><p>Cambia la búsqueda para ver otros clientes.</p></div>
          ) : (
            <table>
              <thead><tr><th>Cliente</th><th>Email</th><th>Teléfono</th><th>País</th><th>Fiscal</th></tr></thead>
              <tbody>{filtered.map((client) => <tr key={client.id} className={client.id === selected?.id ? "selected-row" : ""}><td><button className="table-link" type="button" onClick={() => setSelectedId(client.id)}><strong>{client.display_name}</strong></button></td><td>{client.email || "—"}</td><td>{client.phone || "—"}</td><td>{client.country || "—"}</td><td>{client.tax_id ? "Completable" : "Pendiente"}</td></tr>)}</tbody>
            </table>
          )}
        </div>

        <aside className="client-side card" id="cliente-panel">
          {selected ? (
            <>
              <div className="client-side-header"><span className="client-avatar">{clientInitials(selected)}</span><div><h2>{selected.display_name}</h2><p>{selected.email || "Sin email"}<br />{selected.phone || "Sin teléfono"}</p></div></div>
              <div className="client-badges"><span className="badge">Cliente</span><span className="badge">{selected.client_type === "company" ? "Empresa" : "Persona"}</span></div>
              <section className="side-section"><h3>Datos fiscales</h3><table><tbody><tr><th>NIF/DNI/CIF</th><td>{selected.tax_id || "Pendiente"}</td></tr><tr><th>Dirección fiscal</th><td>{billingAddressText(selected.billing_address)}</td></tr><tr><th>País</th><td>{selected.country || "—"}</td></tr></tbody></table></section>
              <section className="side-section"><h3>Notas</h3><p>{selected.notes || "Sin notas internas."}</p></section>
              <section className="side-actions"><h3>Acciones</h3><a className="quick-action primary" href="/expedientes">Crear expediente <span>→</span></a><a className="quick-action" href="/propuestas">Crear presupuesto <span>→</span></a></section>
            </>
          ) : (
            <div className="empty-state"><h2>Sin cliente seleccionado</h2><p>Selecciona o crea un cliente para ver su ficha.</p></div>
          )}
        </aside>
      </section>
    </div>
  );
}
