"use client";

import { useEffect, useMemo, useState } from "react";
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

export function ClientsManager() {
  const [clients, setClients] = useState<Client[]>(demoClients as Client[]);
  const [loading, setLoading] = useState(!isDemoMode());
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

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

  return (
    <div className="grid">
      <div className="card">
        <div className="header" style={{ marginBottom: 0 }}>
          <div>
            <div className="eyebrow">{isDemoMode() ? "Modo demo" : "Supabase real"}</div>
            <h2>{loading ? "Cargando clientes..." : `${filtered.length} clientes`}</h2>
            {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : <p>Busca por nombre, email, teléfono o fuente.</p>}
          </div>
          <input className="input" style={{ maxWidth: 320 }} placeholder="Buscar cliente" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      </div>
      {filtered.map((client) => (
        <article className="card" key={client.id}>
          <div className="header" style={{ marginBottom: 8 }}>
            <div><span className="badge">{client.source ?? "manual"}</span><h2>{client.display_name}</h2></div>
            <a className="btn secondary" href="/expedientes">Ver expedientes</a>
          </div>
          <table><tbody>{fields.map((field) => <tr key={field}><th>{field}</th><td>{String((client as Record<string, unknown>)[field] ?? "")}</td></tr>)}</tbody></table>
        </article>
      ))}
    </div>
  );
}
