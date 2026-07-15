"use client";

import { useMemo, useState } from "react";

 type Row = Record<string, unknown>;
 type Client360Input = {
  client: Row;
  leads: Row[];
  bookings: Row[];
  tasks: Row[];
  cases: Row[];
  proposals: Row[];
  payments: Row[];
  timeline: Row[];
  filloutUrl: string;
};

type Tab = "resumen" | "comercial" | "viajes" | "economia" | "actividad";

const caseLabels: Record<string, string> = {
  new_lead: "Nuevo",
  call_booked: "Llamada reservada",
  call_done: "Llamada realizada",
  budget_draft: "Presupuesto en preparación",
  proposal_sent: "Presupuesto enviado",
  proposal_accepted: "Presupuesto aceptado",
  contract_ready: "Contrato preparado",
  contract_signed: "Contrato firmado",
  payment_confirmed: "Pago confirmado",
  suppliers_pending: "Proveedores pendientes",
  ready_to_close: "Listo para cierre",
  closed: "Cerrado",
};

const proposalLabels: Record<string, string> = {
  draft: "Borrador",
  internal_review: "Revisión interna",
  sent: "Enviado",
  accepted: "Aceptado",
  rejected: "Rechazado",
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function numberValue(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(numberValue(value));
}

function dateTime(value: unknown) {
  const raw = text(value);
  if (!raw) return "—";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
}

function dateOnly(value: unknown) {
  const raw = text(value);
  if (!raw) return "—";
  const date = new Date(`${raw.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString("es-ES", { dateStyle: "medium" });
}

function one<T extends Row>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) || null;
  return value && typeof value === "object" ? value as T : null;
}

function billingAddress(value: unknown) {
  if (!value) return "—";
  if (typeof value === "string") return value || "—";
  const row = one(value);
  return text(row?.address || row?.street || row?.line1) || "—";
}

function phoneDigits(value: unknown) {
  return text(value).replace(/\D/g, "");
}

function isOpenTask(task: Row) {
  return !["done", "cancelled"].includes(text(task.status));
}

function isOverdue(task: Row) {
  if (!isOpenTask(task) || !task.due_at) return false;
  return new Date(String(task.due_at)).getTime() < Date.now();
}

export function Client360Workspace({ data }: { data: Client360Input }) {
  const [tab, setTab] = useState<Tab>("resumen");
  const [tasks, setTasks] = useState<Row[]>(data.tasks);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const client = data.client;
  const clientId = text(client.id);
  const openTasks = useMemo(() => tasks.filter(isOpenTask), [tasks]);
  const overdueTasks = useMemo(() => openTasks.filter(isOverdue), [openTasks]);
  const activeCases = data.cases.filter((item) => text(item.status) !== "closed");
  const confirmedPayments = data.payments.filter((item) => ["confirmed", "paid", "received"].includes(text(item.status)));
  const proposalByCase = useMemo(() => new Map(data.proposals.map((item) => [text(item.case_id), item])), [data.proposals]);

  const economics = useMemo(() => {
    let acceptedSale = 0;
    let pipeline = 0;
    let expectedProfit = 0;
    for (const proposal of data.proposals) {
      const version = one(proposal.current_version);
      const sale = numberValue(version?.total_sale);
      if (text(proposal.status) === "accepted") acceptedSale += sale;
      else if (text(proposal.status) !== "rejected") pipeline += sale;
      expectedProfit += numberValue(version?.budgeted_profit);
    }
    const paid = confirmedPayments.reduce((sum, item) => sum + numberValue(item.amount), 0);
    return { acceptedSale, pipeline, expectedProfit, paid };
  }, [confirmedPayments, data.proposals]);

  const nextAction = useMemo(() => {
    const task = overdueTasks[0] || openTasks[0];
    if (task) return { title: text(task.title) || "Tarea pendiente", detail: task.due_at ? `${isOverdue(task) ? "Vencida" : "Vence"}: ${dateTime(task.due_at)}` : "Sin fecha límite", kind: isOverdue(task) ? "critical" : "warning" };
    const booking = data.bookings.find((item) => ["booked", "confirmed", "scheduled", "requested"].includes(text(item.status)) && item.starts_at && new Date(String(item.starts_at)).getTime() >= Date.now());
    if (booking) return { title: "Preparar próxima llamada", detail: dateTime(booking.starts_at), kind: "warning" };
    const caseRow = activeCases.find((item) => text(item.next_action));
    if (caseRow) return { title: text(caseRow.next_action), detail: `${text(caseRow.case_code)} · ${text(caseRow.destination) || "Destino pendiente"}`, kind: "normal" };
    return { title: "Sin acciones pendientes", detail: "El cliente no tiene tareas ni expedientes con próxima acción.", kind: "success" };
  }, [activeCases, data.bookings, openTasks, overdueTasks]);

  async function completeTask(taskId: string) {
    setBusyTaskId(taskId);
    setMessage(null);
    const response = await fetch(`/api/routsify/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    const result = await response.json().catch(() => null);
    setBusyTaskId(null);
    if (!response.ok || !result?.ok) {
      setMessage(String(result?.error || "No se pudo completar la tarea."));
      return;
    }
    setTasks((current) => current.map((item) => text(item.id) === taskId ? { ...item, status: "done" } : item));
    setMessage("Tarea completada.");
  }

  const email = text(client.email);
  const phone = phoneDigits(client.phone);
  const reminderText = data.filloutUrl
    ? `Hola, para poder preparar nuestra llamada necesitamos que completes este formulario: ${data.filloutUrl}`
    : "Hola, para poder preparar nuestra llamada necesitamos que completes el formulario de viaje.";

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: "resumen", label: "Resumen" },
    { id: "comercial", label: "Comercial", count: data.leads.length + data.bookings.length },
    { id: "viajes", label: "Expedientes", count: data.cases.length },
    { id: "economia", label: "Economía", count: data.proposals.length },
    { id: "actividad", label: "Actividad", count: data.timeline.length },
  ];

  return <div className="client360">
    <section className="client360-hero card">
      <div className="client360-identity">
        <span className="client-avatar client360-avatar">{text(client.display_name).split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "CL"}</span>
        <div>
          <div className="eyebrow">Cliente 360</div>
          <h2>{text(client.display_name) || "Cliente sin nombre"}</h2>
          <p>{email || "Sin email"} · {text(client.phone) || "Sin teléfono"}</p>
          <div className="client-badges"><span className="badge">{text(client.client_type) === "company" ? "Empresa" : "Persona"}</span><span className="badge">Origen: {text(client.source) || "manual"}</span>{client.holded_contact_id ? <span className="badge">Holded vinculado</span> : null}</div>
        </div>
      </div>
      <div className="client360-actions">
        {email ? <a className="btn secondary" href={`mailto:${encodeURIComponent(email)}`}>Email</a> : null}
        {phone ? <a className="btn secondary" href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer">WhatsApp</a> : null}
        <a className="btn secondary" href={`/expedientes?clientId=${encodeURIComponent(clientId)}`}>Crear expediente</a>
        <a className="btn" href={`/clientes`}>Volver a clientes</a>
      </div>
    </section>

    <section className="client-kpis client360-kpis">
      <div className="kpi-card"><span className="kpi-icon">T</span><span className="kpi-copy"><strong>Tareas abiertas</strong><b>{openTasks.length}</b><small>{overdueTasks.length ? `${overdueTasks.length} vencida(s)` : "Al día"}</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">V</span><span className="kpi-copy"><strong>Expedientes</strong><b>{data.cases.length}</b><small>{activeCases.length} activos</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">€</span><span className="kpi-copy"><strong>Venta aceptada</strong><b>{money(economics.acceptedSale)}</b><small>{data.proposals.filter((item) => text(item.status) === "accepted").length} presupuesto(s)</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">P</span><span className="kpi-copy"><strong>Cobrado</strong><b>{money(economics.paid)}</b><small>Pagos confirmados</small></span></div>
    </section>

    <section className={`card client360-next client360-next-${nextAction.kind}`}>
      <div><div className="eyebrow">Próxima mejor acción</div><h2>{nextAction.title}</h2><p>{nextAction.detail}</p></div>
      {overdueTasks[0]?.id ? <button className="btn" type="button" disabled={busyTaskId === text(overdueTasks[0].id)} onClick={() => void completeTask(text(overdueTasks[0].id))}>{busyTaskId === text(overdueTasks[0].id) ? "Guardando..." : "Marcar completada"}</button> : null}
    </section>

    {message ? <p className="client-message" role="status">{message}</p> : null}

    <nav className="client360-tabs" aria-label="Secciones del cliente">
      {tabs.map((item) => <button key={item.id} type="button" className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>{item.label}{item.count !== undefined ? <span>{item.count}</span> : null}</button>)}
    </nav>

    {tab === "resumen" ? <div className="client360-grid">
      <section className="card">
        <div className="panel-head"><div><h2>Datos del cliente</h2><p>Contacto, fiscalidad y sincronización.</p></div><a className="btn secondary" href={`/clientes#cliente-panel`}>Editar en clientes</a></div>
        <dl className="client360-dl">
          <div><dt>Email</dt><dd>{email || "Pendiente"}</dd></div>
          <div><dt>Teléfono</dt><dd>{text(client.phone) || "Pendiente"}</dd></div>
          <div><dt>NIF / DNI / CIF</dt><dd>{text(client.tax_id) || "Pendiente"}</dd></div>
          <div><dt>Dirección fiscal</dt><dd>{billingAddress(client.billing_address)}</dd></div>
          <div><dt>País</dt><dd>{text(client.country) || "—"}</dd></div>
          <div><dt>Idioma</dt><dd>{text(client.language) || "es"}</dd></div>
          <div><dt>Holded</dt><dd>{client.holded_contact_id ? "Vinculado" : "Pendiente"}</dd></div>
          <div><dt>Creado</dt><dd>{dateTime(client.created_at)}</dd></div>
        </dl>
        <div className="client360-note"><strong>Notas internas</strong><p>{text(client.notes) || "Sin notas internas."}</p></div>
      </section>

      <section className="card">
        <div className="panel-head"><div><h2>Tareas y seguimiento</h2><p>Acciones abiertas del cliente y de sus expedientes.</p></div><span className="badge">{openTasks.length} abiertas</span></div>
        {openTasks.length === 0 ? <div className="empty-state"><h3>Sin tareas pendientes</h3><p>No hay acciones abiertas para este cliente.</p></div> : <div className="client360-list">{openTasks.slice(0, 8).map((task) => {
          const taskId = text(task.id);
          const payload = one(task.payload) || {};
          const isReminder = text(payload.action_type) === "fillout_reminder";
          return <article className={`client360-list-item ${isOverdue(task) ? "is-overdue" : ""}`} key={taskId}>
            <div><strong>{text(task.title) || "Tarea"}</strong><small>{task.due_at ? dateTime(task.due_at) : "Sin fecha"} · {text(task.priority) || "normal"}</small></div>
            <div className="client360-row-actions">
              {isReminder && email ? <a className="btn secondary" href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("Formulario previo a tu llamada con Routsify")}&body=${encodeURIComponent(text(payload.suggested_message) || reminderText)}`}>Email</a> : null}
              {isReminder && phone ? <a className="btn secondary" href={`https://wa.me/${phone}?text=${encodeURIComponent(text(payload.suggested_message) || reminderText)}`} target="_blank" rel="noreferrer">WhatsApp</a> : null}
              <button className="btn" type="button" disabled={busyTaskId === taskId} onClick={() => void completeTask(taskId)}>{busyTaskId === taskId ? "Guardando..." : "Completar"}</button>
            </div>
          </article>;
        })}</div>}
      </section>
    </div> : null}

    {tab === "comercial" ? <div className="client360-grid">
      <section className="card">
        <div className="panel-head"><div><h2>Solicitudes y formularios</h2><p>Historial comercial previo al expediente.</p></div><span className="badge">{data.leads.length}</span></div>
        {data.leads.length === 0 ? <div className="empty-state"><h3>Sin solicitudes</h3><p>No hay formularios o leads asociados.</p></div> : <div className="client360-list">{data.leads.map((lead) => <article className="client360-list-item" key={text(lead.id)}><div><strong>{text(lead.destination) || "Destino pendiente"}</strong><small>{text(lead.source) || "manual"} · {text(lead.status) || "nuevo"} · {dateTime(lead.created_at)}</small></div><div className="client360-metrics"><span>{lead.travelers ? `${numberValue(lead.travelers)} viajero(s)` : "Viajeros sin indicar"}</span><span>{lead.budget_hint ? money(lead.budget_hint) : "Presupuesto sin indicar"}</span></div></article>)}</div>}
      </section>
      <section className="card">
        <div className="panel-head"><div><h2>Llamadas</h2><p>Reservas y estado de las llamadas comerciales.</p></div><span className="badge">{data.bookings.length}</span></div>
        {data.bookings.length === 0 ? <div className="empty-state"><h3>Sin llamadas</h3><p>No hay reservas asociadas.</p></div> : <div className="client360-list">{data.bookings.map((booking) => <article className="client360-list-item" key={text(booking.id)}><div><strong>{text(booking.event_type) || "Llamada comercial"}</strong><small>{dateTime(booking.starts_at)} · {text(booking.status) || "reservada"}</small></div><span className="badge">{text(booking.source) || "booking"}</span></article>)}</div>}
      </section>
    </div> : null}

    {tab === "viajes" ? <section className="card">
      <div className="panel-head"><div><h2>Expedientes y viajes</h2><p>Todos los viajes del cliente desde una sola ficha.</p></div><a className="btn" href={`/expedientes?clientId=${encodeURIComponent(clientId)}`}>Nuevo expediente</a></div>
      {data.cases.length === 0 ? <div className="empty-state"><h3>Sin expedientes</h3><p>El cliente todavía no tiene viajes creados.</p></div> : <div className="table-scroll"><table><thead><tr><th>Expediente</th><th>Destino</th><th>Fechas</th><th>Estado</th><th>Próxima acción</th><th>Venta</th><th></th></tr></thead><tbody>{data.cases.map((caseRow) => {
        const caseId = text(caseRow.id);
        const proposal = proposalByCase.get(caseId);
        return <tr key={caseId}><td><strong>{text(caseRow.case_code)}</strong></td><td>{text(caseRow.destination) || "—"}</td><td>{caseRow.trip_start || caseRow.trip_end ? `${dateOnly(caseRow.trip_start)} → ${dateOnly(caseRow.trip_end)}` : "Sin fechas"}</td><td>{caseLabels[text(caseRow.status)] || text(caseRow.status) || "—"}</td><td>{text(caseRow.next_action) || "—"}</td><td>{money(caseRow.accepted_value, text(caseRow.currency) || "EUR")}</td><td><div className="client360-row-actions"><a className="btn secondary" href={`/expedientes/${encodeURIComponent(text(caseRow.case_code) || caseId)}`}>Abrir</a>{proposal?.id ? <a className="btn secondary" href={`/propuestas/editar/${encodeURIComponent(text(proposal.id))}`}>Presupuesto</a> : <a className="btn secondary" href={`/propuestas?caseId=${encodeURIComponent(caseId)}`}>Crear presupuesto</a>}</div></td></tr>;
      })}</tbody></table></div>}
    </section> : null}

    {tab === "economia" ? <div className="client360-grid">
      <section className="card">
        <div className="panel-head"><div><h2>Resumen económico</h2><p>Visión agregada del cliente.</p></div></div>
        <dl className="client360-dl client360-dl-economic">
          <div><dt>Venta aceptada</dt><dd>{money(economics.acceptedSale)}</dd></div>
          <div><dt>Pipeline abierto</dt><dd>{money(economics.pipeline)}</dd></div>
          <div><dt>Beneficio previsto</dt><dd>{money(economics.expectedProfit)}</dd></div>
          <div><dt>Cobrado confirmado</dt><dd>{money(economics.paid)}</dd></div>
          <div><dt>Lifetime value guardado</dt><dd>{money(client.lifetime_value)}</dd></div>
          <div><dt>Presupuestos</dt><dd>{data.proposals.length}</dd></div>
        </dl>
      </section>
      <section className="card">
        <div className="panel-head"><div><h2>Presupuestos</h2><p>Última versión económica de cada expediente.</p></div><span className="badge">{data.proposals.length}</span></div>
        {data.proposals.length === 0 ? <div className="empty-state"><h3>Sin presupuestos</h3><p>No hay presupuestos asociados.</p></div> : <div className="client360-list">{data.proposals.map((proposal) => {
          const version = one(proposal.current_version);
          const caseRow = data.cases.find((item) => text(item.id) === text(proposal.case_id));
          return <article className="client360-list-item" key={text(proposal.id)}><div><strong>{text(caseRow?.case_code) || "Presupuesto"} · {text(caseRow?.destination) || "Destino"}</strong><small>{proposalLabels[text(proposal.status)] || text(proposal.status)} · v{numberValue(version?.version_number) || 1}</small></div><div className="client360-metrics"><span>Venta {money(version?.total_sale)}</span><span>Beneficio {money(version?.budgeted_profit)}</span><a className="btn secondary" href={`/propuestas/editar/${encodeURIComponent(text(proposal.id))}`}>Abrir</a></div></article>;
        })}</div>}
      </section>
      <section className="card client360-full">
        <div className="panel-head"><div><h2>Pagos</h2><p>Pagos registrados en todos los expedientes del cliente.</p></div><span className="badge">{data.payments.length}</span></div>
        {data.payments.length === 0 ? <div className="empty-state"><h3>Sin pagos</h3><p>Todavía no hay pagos registrados.</p></div> : <div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Expediente</th><th>Referencia</th><th>Método</th><th>Estado</th><th>Importe</th></tr></thead><tbody>{data.payments.map((payment) => {
          const caseRow = data.cases.find((item) => text(item.id) === text(payment.case_id));
          return <tr key={text(payment.id)}><td>{dateTime(payment.received_at || payment.confirmed_at || payment.created_at)}</td><td>{text(caseRow?.case_code) || "—"}</td><td>{text(payment.payment_reference) || "—"}</td><td>{text(payment.method || payment.provider) || "—"}</td><td>{text(payment.status) || "—"}</td><td>{money(payment.amount, text(payment.currency) || "EUR")}</td></tr>;
        })}</tbody></table></div>}
      </section>
    </div> : null}

    {tab === "actividad" ? <section className="card">
      <div className="panel-head"><div><h2>Timeline del cliente</h2><p>Actividad reciente registrada en Routsify.</p></div><span className="badge">{data.timeline.length}</span></div>
      {data.timeline.length === 0 ? <div className="empty-state"><h3>Sin actividad</h3><p>Los eventos del cliente aparecerán aquí.</p></div> : <div className="client360-timeline">{data.timeline.map((event) => <article key={text(event.id)}><span className="client360-timeline-dot"/><div><strong>{text(event.title) || text(event.event_type) || "Actividad"}</strong><small>{dateTime(event.created_at)} · {text(event.event_type)}</small></div></article>)}</div>}
    </section> : null}
  </div>;
}
