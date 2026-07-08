"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isDemoMode } from "@/lib/supabase-browser";
import { clients as demoClients } from "@/lib/mock-data";
import type { Client } from "@/lib/types";

const fields = [
  "display_name",
  "client_type",
  "first_name",
  "last_name",
  "company_name",
  "email",
  "email_normalized",
  "phone",
  "phone_normalized",
  "tax_id",
  "billing_address",
  "country",
  "language",
  "source",
  "holded_contact_id",
  "notes",
];

type ClientDraft = {
  client_type: string;
  display_name: string;
  first_name: string;
  last_name: string;
  company_name: string;
  email: string;
  phone: string;
  tax_id: string;
  billing_address: string;
  country: string;
  language: string;
  source: string;
  notes: string;
};

const emptyDraft: ClientDraft = {
  client_type: "person",
  display_name: "",
  first_name: "",
  last_name: "",
  company_name: "",
  email: "",
  phone: "",
  tax_id: "",
  billing_address: "",
  country: "ES",
  language: "es",
  source: "manual",
  notes: "",
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase() || null;
}

function normalizePhone(phone: string) {
  const normalized = phone.replace(/\D/g, "");
  return normalized || null;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function ClientsManager() {
  const [clients, setClients] = useState<Client[]>(demoClients as Client[]);
  const [loading, setLoading] = useState(!isDemoMode());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<ClientDraft>(emptyDraft);

  useEffect(() => {
    if (isDemoMode()) return;

    const supabase = getSupabaseBrowserClient();
    supabase
      .from("clients")
      .select("id,display_name,client_type,first_name,last_name,company_name,email,email_normalized,phone,phone_normalized,tax_id,billing_address,country,language,source,holded_contact_id,notes")
      .order("created_at", { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (fetchError) setError(fetchError.message);
        if (data) setClients(data as Client[]);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return clients;
    return clients.filter((client) => [client.display_name, client.email, client.phone, client.source].some((value) => String(value ?? "").toLowerCase().includes(normalized)));
  }, [clients, query]);

  function updateDraft<K extends keyof ClientDraft>(key: K, value: ClientDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function createClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const displayName = draft.display_name.trim() || [draft.first_name, draft.last_name].filter(Boolean).join(" ").trim() || draft.company_name.trim();
    if (!displayName) {
      setError("El cliente necesita nombre visible, nombre/apellidos o empresa.");
      return;
    }

    const emailNormalized = normalizeEmail(draft.email);
    const phoneNormalized = normalizePhone(draft.phone);

    const payload = {
      client_type: draft.client_type,
      display_name: displayName,
      first_name: draft.first_name.trim() || null,
      last_name: draft.last_name.trim() || null,
      company_name: draft.company_name.trim() || null,
      email: draft.email.trim() || null,
      email_normalized: emailNormalized,
      phone: draft.phone.trim() || null,
      phone_normalized: phoneNormalized,
      tax_id: draft.tax_id.trim() || null,
      billing_address: draft.billing_address.trim() ? { raw: draft.billing_address.trim() } : {},
      country: draft.country.trim() || "ES",
      language: draft.language.trim() || "es",
      source: draft.source.trim() || "manual",
      notes: draft.notes.trim() || null,
    };

    if (isDemoMode()) {
      setClients((current) => [{ id: `demo-client-${Date.now()}`, ...payload } as Client, ...current]);
      setDraft(emptyDraft);
      setMessage("Cliente creado en modo demo. Cuando activemos Supabase real quedará guardado en base de datos.");
      return;
    }

    setSaving(true);
    const supabase = getSupabaseBrowserClient();
    const { data: profile, error: profileError } = await supabase.from("profiles").select("organization_id").single();

    if (profileError || !profile) {
      setSaving(false);
      setError(profileError?.message ?? "No se ha podido resolver la organización del usuario.");
      return;
    }

    const { data, error: insertError } = await supabase
      .from("clients")
      .insert({ organization_id: profile.organization_id, ...payload })
      .select("id,display_name,client_type,first_name,last_name,company_name,email,email_normalized,phone,phone_normalized,tax_id,billing_address,country,language,source,holded_contact_id,notes")
      .single();

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setClients((current) => [data as Client, ...current]);
    setDraft(emptyDraft);
    setMessage("Cliente guardado en Supabase.");
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="header" style={{ marginBottom: 0 }}>
          <div>
            <div className="eyebrow">{isDemoMode() ? "Modo demo" : "Supabase real"}</div>
            <h2>{loading ? "Cargando clientes..." : `${filtered.length} clientes`}</h2>
            {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : <p>Busca por nombre, email, teléfono o fuente.</p>}
            {message ? <p>{message}</p> : null}
          </div>
          <input className="input" style={{ maxWidth: 320 }} placeholder="Buscar cliente" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      </div>

      <section className="card">
        <div className="eyebrow">Nuevo cliente</div>
        <h2>Alta rápida con deduplicación preparada</h2>
        <form className="form" onSubmit={createClient}>
          <div className="grid grid-3">
            <label>Tipo<select value={draft.client_type} onChange={(event) => updateDraft("client_type", event.target.value)}><option value="person">Persona</option><option value="company">Empresa</option></select></label>
            <label>Nombre visible<input className="input" value={draft.display_name} onChange={(event) => updateDraft("display_name", event.target.value)} placeholder="Laura Martín" /></label>
            <label>Fuente<input className="input" value={draft.source} onChange={(event) => updateDraft("source", event.target.value)} placeholder="manual / fillout" /></label>
          </div>
          <div className="grid grid-3">
            <label>Nombre<input className="input" value={draft.first_name} onChange={(event) => updateDraft("first_name", event.target.value)} /></label>
            <label>Apellidos<input className="input" value={draft.last_name} onChange={(event) => updateDraft("last_name", event.target.value)} /></label>
            <label>Empresa<input className="input" value={draft.company_name} onChange={(event) => updateDraft("company_name", event.target.value)} /></label>
          </div>
          <div className="grid grid-3">
            <label>Email<input className="input" type="email" value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} /></label>
            <label>Teléfono<input className="input" value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} /></label>
            <label>NIF/CIF/Pasaporte<input className="input" value={draft.tax_id} onChange={(event) => updateDraft("tax_id", event.target.value)} /></label>
          </div>
          <div className="grid grid-3">
            <label>País<input className="input" value={draft.country} onChange={(event) => updateDraft("country", event.target.value)} /></label>
            <label>Idioma<input className="input" value={draft.language} onChange={(event) => updateDraft("language", event.target.value)} /></label>
            <label>Dirección facturación<input className="input" value={draft.billing_address} onChange={(event) => updateDraft("billing_address", event.target.value)} /></label>
          </div>
          <label>Notas<textarea className="input" rows={3} value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} /></label>
          <button className="btn" type="submit" disabled={saving}>{saving ? "Guardando..." : "Crear cliente"}</button>
        </form>
      </section>

      {filtered.map((client) => (
        <article className="card" key={client.id}>
          <div className="header" style={{ marginBottom: 8 }}>
            <div><span className="badge">{client.source ?? "manual"}</span><h2>{client.display_name}</h2></div>
            <a className="btn secondary" href="/expedientes">Ver expedientes</a>
          </div>
          <table><tbody>{fields.map((field) => <tr key={field}><th>{field}</th><td>{formatValue((client as Record<string, unknown>)[field])}</td></tr>)}</tbody></table>
        </article>
      ))}
    </div>
  );
}
