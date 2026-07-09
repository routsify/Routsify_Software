"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ClientDraftInput,
  ClientMaster,
  ClientOrigin,
  clientAlerts,
  clientFiscalMissing,
  clientInitials,
  clientKpis,
  createDemoClient,
  demoClientMasters,
  filterClientMasters,
  formatClientMoney,
  possibleDuplicate,
  simulateHoldedSync,
} from "@/lib/client-master";

const origins = ["Todos", "Web", "Fillout", "Booking", "Referral", "Agencia", "Manual"];
const holdedStatuses = ["Todos", "sincronizado", "pendiente", "con_error", "sin_datos"];
const owners = ["Todos", "Laura Pérez", "Diego Romero", "Sofía Martínez", "Carlos Vega"];
const issueFilters = ["Todos", "Duplicados", "Sin fiscal", "Con error", "Aceptados"];

const emptyDraft: ClientDraftInput = {
  display_name: "",
  email: "",
  phone: "",
  origin: "Manual",
  owner: "Laura Pérez",
  tax_id: "",
  billing_address: "",
  fiscal_email: "",
};

function holdedLabel(status: ClientMaster["holded_status"]) {
  if (status === "sincronizado") return "Sincronizado";
  if (status === "pendiente") return "Pendiente";
  if (status === "con_error") return "Con error";
  return "Sin datos";
}

function holdedClass(status: ClientMaster["holded_status"]) {
  if (status === "sincronizado") return "status-progress";
  if (status === "pendiente") return "priority-normal";
  if (status === "con_error") return "priority-urgent";
  return "status-pill";
}

export function ClientsManager() {
  const [clients, setClients] = useState<ClientMaster[]>(demoClientMasters);
  const [selectedId, setSelectedId] = useState(demoClientMasters[0].id);
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState("Todos");
  const [holded, setHolded] = useState("Todos");
  const [owner, setOwner] = useState("Todos");
  const [issue, setIssue] = useState("Todos");
  const [draft, setDraft] = useState<ClientDraftInput>(emptyDraft);
  const [message, setMessage] = useState<string | null>(null);

  const kpis = useMemo(() => clientKpis(clients), [clients]);
  const filtered = useMemo(() => filterClientMasters(clients, { query, origin, holded, owner, issue }), [clients, query, origin, holded, owner, issue]);
  const selected = clients.find((client) => client.id === selectedId) || filtered[0] || clients[0];
  const selectedAlerts = selected ? clientAlerts(selected, clients) : [];
  const fiscalMissing = selected ? clientFiscalMissing(selected) : [];
  const duplicate = selected ? possibleDuplicate(selected, clients) : undefined;

  function updateDraft<K extends keyof ClientDraftInput>(key: K, value: ClientDraftInput[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function createClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.display_name.trim()) {
      setMessage("El cliente necesita nombre visible para crear ficha maestra.");
      return;
    }
    const result = createDemoClient(draft, clients);
    if (!result.ok) {
      setMessage(`${result.reason}. No se crea ficha nueva; actualiza la existente o revisa duplicado.`);
      setSelectedId(result.existing.id);
      return;
    }
    setClients((current) => [result.client, ...current]);
    setSelectedId(result.client.id);
    setDraft(emptyDraft);
    setMessage("Cliente creado en modo demo como ficha única. Si entra por Fillout/Booking se vinculará por email/teléfono.");
  }

  function syncHolded(id: string) {
    setClients((current) => current.map((client) => client.id === id ? simulateHoldedSync(client) : client));
    setMessage("Sincronización Holded simulada. Si faltan datos fiscales, queda error accionable sin duplicar contacto.");
  }

  function markAsMaster(id: string) {
    setClients((current) => current.map((client) => client.id === id ? { ...client, duplicate_status: "unique", possible_duplicate_of: undefined, notes: "Marcado como ficha maestra revisada." } : client));
    setMessage("Ficha marcada como única en modo demo. En real quedará auditado.");
  }

  return (
    <div className="clients-page">
      <section className="client-kpis">
        <a className="kpi-card" href="#clientes-listado"><span className="kpi-icon">👥</span><span className="kpi-copy"><strong>Clientes activos</strong><b>{kpis.active}</b><small>+18 vs. mes anterior ↑</small></span></a>
        <a className="kpi-card" href="#clientes-listado"><span className="kpi-icon">↻</span><span className="kpi-copy"><strong>Pendientes de sync</strong><b>{kpis.pendingSync}</b><small>Por sincronizar con Holded</small></span></a>
        <a className="kpi-card" href="#clientes-listado"><span className="kpi-icon">€</span><span className="kpi-copy"><strong>Valor aceptado</strong><b>{formatClientMoney(kpis.acceptedValue)}</b><small>Presupuestos aceptados</small></span></a>
        <a className="kpi-card" href="#clientes-listado"><span className="kpi-icon">!</span><span className="kpi-copy"><strong>Duplicados por revisar</strong><b>{kpis.duplicates}</b><small>Revisión recomendada</small></span></a>
      </section>

      <section className="clients-layout">
        <div className="card clients-main" id="clientes-listado">
          <div className="client-filters">
            <input className="input" placeholder="Buscar cliente..." value={query} onChange={(event) => setQuery(event.target.value)} />
            <label>Origen<select value={origin} onChange={(event) => setOrigin(event.target.value)}>{origins.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>Estado Holded<select value={holded} onChange={(event) => setHolded(event.target.value)}>{holdedStatuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>Responsable<select value={owner} onChange={(event) => setOwner(event.target.value)}>{owners.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>Problema<select value={issue} onChange={(event) => setIssue(event.target.value)}>{issueFilters.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <details className="new-client-drawer">
              <summary className="btn">+ Nuevo cliente</summary>
              <form className="form" onSubmit={createClient}>
                <label>Nombre visible<input className="input" value={draft.display_name} onChange={(event) => updateDraft("display_name", event.target.value)} placeholder="Nombre del cliente" /></label>
                <div className="grid grid-2"><label>Email<input className="input" type="email" value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} /></label><label>Teléfono<input className="input" value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} /></label></div>
                <div className="grid grid-2"><label>Origen<select value={draft.origin} onChange={(event) => updateDraft("origin", event.target.value as ClientOrigin)}>{origins.filter((item) => item !== "Todos").map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Responsable<select value={draft.owner} onChange={(event) => updateDraft("owner", event.target.value)}>{owners.filter((item) => item !== "Todos").map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>
                <div className="grid grid-2"><label>NIF/DNI/CIF<input className="input" value={draft.tax_id} onChange={(event) => updateDraft("tax_id", event.target.value)} /></label><label>Email facturación<input className="input" value={draft.fiscal_email} onChange={(event) => updateDraft("fiscal_email", event.target.value)} /></label></div>
                <label>Dirección fiscal<input className="input" value={draft.billing_address} onChange={(event) => updateDraft("billing_address", event.target.value)} /></label>
                <button className="btn" type="submit">Crear ficha única</button>
              </form>
            </details>
          </div>
          {message ? <p className="client-message">{message}</p> : null}

          <table>
            <thead><tr><th>Cliente</th><th>Origen</th><th>Valor aceptado</th><th>Estado Holded</th><th>Expedientes</th><th>Responsable</th><th></th></tr></thead>
            <tbody>{filtered.map((client) => {
              const alerts = clientAlerts(client, clients);
              return <tr key={client.id} className={client.id === selected.id ? "selected-row" : ""}><td><button className="table-link" type="button" onClick={() => setSelectedId(client.id)}><strong>{client.display_name}</strong></button>{alerts.length ? <><br/><small>{alerts[0]}</small></> : null}</td><td><span className="status-pill status-progress">{client.origin}</span></td><td>{formatClientMoney(client.accepted_value)}</td><td><span className={`status-pill ${holdedClass(client.holded_status)}`}>{holdedLabel(client.holded_status)}</span></td><td>{client.cases_count}</td><td>{client.owner}</td><td><button className="icon-button" type="button" onClick={() => setSelectedId(client.id)}>⋮</button></td></tr>;
            })}</tbody>
          </table>
          <div className="table-pagination"><span>Mostrando 1 a {filtered.length} de {clients.length} clientes</span><span><button className="btn secondary">‹</button><button className="btn">1</button><button className="btn secondary">2</button><button className="btn secondary">3</button><button className="btn secondary">›</button></span></div>
        </div>

        <aside className="client-side card" id="cliente-panel">
          <div className="client-side-header">
            <span className="client-avatar">{clientInitials(selected)}</span>
            <div><h2>{selected.display_name}</h2><p>{selected.email}<br/>{selected.phone}</p></div>
          </div>
          <div className="client-badges"><span className="badge">Ficha única</span><span className="badge">{duplicate ? "Duplicado posible" : "Sin duplicados"}</span><span className="badge">Cliente activo</span></div>

          <section className="side-section"><h3>Datos fiscales</h3><table><tbody><tr><th>NIF/DNI/CIF</th><td>{selected.tax_id || "pendiente"}</td></tr><tr><th>Dirección fiscal</th><td>{String(selected.billing_address || "pendiente")}</td></tr><tr><th>País fiscal</th><td>{selected.fiscal_country || selected.country || "pendiente"}</td></tr><tr><th>Email de facturación</th><td>{selected.fiscal_email || selected.email || "pendiente"}</td></tr></tbody></table>{fiscalMissing.length ? <p className="danger-text">Falta: {fiscalMissing.join(", ")}</p> : <p>Datos fiscales mínimos completos.</p>}</section>

          <section className="side-section"><h3>Estado Holded</h3><table><tbody><tr><th>holded_contact_id</th><td>{selected.holded_contact_id || "sin contacto"}</td></tr><tr><th>Última sincronización</th><td>{selected.holded_last_sync || "pendiente"}</td></tr><tr><th>Estado</th><td><span className={`status-pill ${holdedClass(selected.holded_status)}`}>{holdedLabel(selected.holded_status)}</span></td></tr><tr><th>Último error</th><td>{selected.holded_last_error || "—"}</td></tr></tbody></table></section>

          <section className="side-section"><h3>Historial resumido</h3><table><tbody><tr><th>Primer contacto</th><td>{selected.first_contact_at}</td></tr><tr><th>Último contacto</th><td>{selected.last_contact_at}</td></tr><tr><th>Expedientes</th><td>{selected.cases_count}</td></tr><tr><th>Presupuestos aceptados</th><td>{selected.accepted_proposals}</td></tr><tr><th>Valor vendido</th><td>{formatClientMoney(selected.accepted_value)}</td></tr><tr><th>Pagos recibidos</th><td>{formatClientMoney(selected.payments_received)}</td></tr></tbody></table></section>

          <section className="side-section"><h3>Alertas</h3>{selectedAlerts.length ? selectedAlerts.map((alert) => <p key={alert} className="danger-text">⚠ {alert}</p>) : <p>Sin alertas críticas.</p>}</section>

          <section className="side-actions"><h3>Acciones rápidas</h3><a className="quick-action" href="#cliente-panel">Ver ficha completa <span>→</span></a><a className="quick-action" href="/expedientes">Crear expediente <span>→</span></a><a className="quick-action primary" href="/propuestas">Nuevo presupuesto <span>→</span></a><button className="quick-action" type="button" onClick={() => markAsMaster(selected.id)}>Revisar duplicados <span>→</span></button><button className="quick-action" type="button" onClick={() => syncHolded(selected.id)}>Sincronizar Holded <span>→</span></button></section>

          <div className="client-footnote">Esta es la ficha maestra del cliente. Toda la actividad se centraliza aquí.</div>
        </aside>
      </section>
    </div>
  );
}
