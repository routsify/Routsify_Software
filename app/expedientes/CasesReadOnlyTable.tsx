type CaseRow = {
  id?: string;
  case_code?: string;
  title?: string | null;
  status?: string | null;
  destination?: string | null;
  trip_start?: string | null;
  trip_end?: string | null;
  next_action?: string | null;
  blocker?: string | null;
  accepted_value?: number | string | null;
  currency?: string | null;
  clients?: { display_name?: string | null; email?: string | null } | Array<{ display_name?: string | null; email?: string | null }> | null;
};

const statusLabels: Record<string, string> = {
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

function clientOf(item: CaseRow) {
  return Array.isArray(item.clients) ? item.clients[0] : item.clients;
}

function money(value: unknown, currency = "EUR") {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric === 0) return "—";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(numeric);
}

export function CasesReadOnlyTable({ initialCases = [] }: { initialCases?: unknown[] }) {
  const cases = initialCases as CaseRow[];
  const active = cases.filter((item) => item.status !== "closed").length;
  const blocked = cases.filter((item) => item.blocker).length;
  const closed = cases.filter((item) => item.status === "closed").length;
  const acceptedValue = cases.reduce((sum, item) => sum + Number(item.accepted_value || 0), 0);

  return <div className="clients-page">
    <section className="card form-warning">
      <strong>Modo consulta</strong>
      <p>Tu rol puede revisar los expedientes y abrir su detalle, pero no crear ni modificar estados, fechas o datos operativos.</p>
    </section>

    <section className="client-kpis">
      <div className="kpi-card"><span className="kpi-icon">E</span><span className="kpi-copy"><strong>Expedientes</strong><b>{cases.length}</b><small>Total registrados</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">A</span><span className="kpi-copy"><strong>Activos</strong><b>{active}</b><small>En curso</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">!</span><span className="kpi-copy"><strong>Con bloqueo</strong><b>{blocked}</b><small>Necesitan atención</small></span></div>
      <div className="kpi-card"><span className="kpi-icon">€</span><span className="kpi-copy"><strong>Venta aceptada</strong><b>{money(acceptedValue)}</b><small>{closed} cerrados</small></span></div>
    </section>

    <section className="card">
      {cases.length === 0 ? <div className="empty-state"><h2>Todavía no hay expedientes</h2><p>No hay información disponible para consultar.</p></div> : <div className="table-scroll"><table>
        <thead><tr><th>Expediente</th><th>Cliente</th><th>Destino / fechas</th><th>Estado</th><th>Próxima acción</th><th>Venta aceptada</th><th></th></tr></thead>
        <tbody>{cases.map((item, index) => {
          const client = clientOf(item);
          const caseCode = String(item.case_code || `Expediente ${index + 1}`);
          return <tr key={String(item.id || caseCode)}>
            <td><strong>{caseCode}</strong><br /><small>{String(item.title || "")}</small></td>
            <td>{String(client?.display_name || "—")}<br /><small>{String(client?.email || "")}</small></td>
            <td>{String(item.destination || "—")}<br /><small>{String(item.trip_start || "Sin fecha")} → {String(item.trip_end || "Sin fecha")}</small></td>
            <td>{statusLabels[String(item.status || "new_lead")] || String(item.status || "—")}{item.blocker ? <><br /><small>{item.blocker}</small></> : null}</td>
            <td>{String(item.next_action || "—")}</td>
            <td>{money(item.accepted_value, String(item.currency || "EUR"))}</td>
            <td><a className="btn secondary" href={`/expedientes/${encodeURIComponent(caseCode)}`}>Consultar</a></td>
          </tr>;
        })}</tbody>
      </table></div>}
    </section>
  </div>;
}
