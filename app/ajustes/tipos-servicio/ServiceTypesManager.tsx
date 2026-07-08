"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isDemoMode } from "@/lib/supabase-browser";
import { serviceTypes as demoServiceTypes } from "@/lib/mock-data";
import type { ServiceType } from "@/lib/types";

export function ServiceTypesManager() {
  const [items, setItems] = useState<ServiceType[]>(demoServiceTypes as ServiceType[]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isDemoMode());

  useEffect(() => {
    if (isDemoMode()) return;

    const supabase = getSupabaseBrowserClient();
    supabase
      .from("service_types")
      .select("id,code,name,is_active,sort_order")
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (error) setMessage(error.message);
        if (data) setItems(data as ServiceType[]);
        setLoading(false);
      });
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const normalizedCode = code.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const normalizedName = name.trim();
    if (!normalizedCode || !normalizedName) return;

    if (isDemoMode()) {
      setItems((current) => [...current, { code: normalizedCode, name: normalizedName, active: true }]);
      setCode("");
      setName("");
      setMessage("Tipo añadido en modo demo. No se ha guardado en Supabase.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { data: profile, error: profileError } = await supabase.from("profiles").select("organization_id").single();

    if (profileError || !profile) {
      setMessage(profileError?.message ?? "No se ha podido resolver la organización del usuario.");
      return;
    }

    const { data, error } = await supabase
      .from("service_types")
      .insert({ organization_id: profile.organization_id, code: normalizedCode, name: normalizedName, is_active: true })
      .select("id,code,name,is_active,sort_order")
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    setItems((current) => [...current, data as ServiceType]);
    setCode("");
    setName("");
    setMessage("Tipo guardado en Supabase.");
  }

  return (
    <section className="grid grid-2">
      <div className="card">
        <div className="eyebrow">{isDemoMode() ? "Modo demo" : "Supabase real"}</div>
        <h2>{loading ? "Cargando tipos..." : `${items.length} tipos`}</h2>
        <table>
          <thead><tr><th>Código</th><th>Nombre</th><th>Activo</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.id ?? item.code}><td>{item.code}</td><td><strong>{item.name}</strong></td><td>{item.is_active ?? item.active ? "Sí" : "No"}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="card">
        <div className="eyebrow">Nuevo tipo</div>
        <h2>Ampliar catálogo</h2>
        <form className="form" onSubmit={onSubmit}>
          <input className="input" placeholder="Código: train" value={code} onChange={(event) => setCode(event.target.value)} />
          <input className="input" placeholder="Nombre: Tren" value={name} onChange={(event) => setName(event.target.value)} />
          {message ? <p>{message}</p> : null}
          <button className="btn" type="submit">Guardar tipo</button>
        </form>
      </div>
    </section>
  );
}
