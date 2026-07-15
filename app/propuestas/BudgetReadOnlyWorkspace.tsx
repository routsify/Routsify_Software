type RecordRow = Record<string, unknown>;

type BudgetLine = {
  id?: string;
  service_type_code?: string | null;
  description_public?: string | null;
  supplier_name?: string | null;
  destination_segment?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  cost_budget?: number | string | null;
  cost_real?: number | string | null;
  sale_price?: number | string | null;
  margin_applied?: number | string | null;
  creates_expected_purchase?: boolean | null;
};

type Version = {
  id?: string;
  version_number?: number | string | null;
  status?: string | null;
  locked?: boolean | null;
  created_at?: string | null;
  total_sale?: number | string | null;
  total_cost_budget?: number | string | null;
  total_cost_real?: number | string | null;
  budgeted_profit?: number | string | null;
  real_profit?: number | string | null;
  real_margin_pct?: number | string | null;
  budget_lines?: BudgetLine[] | null;
};

const serviceLabels: Record<string, string> = {
  flight: "Vuelo",
  accommodation: "Alojamiento",
  transfer: "Traslado",
  rail: "Tren",
  ferry: "Ferry",
  rental_car: "Coche de alquiler",
  insurance: "Seguro",
  activity: "Actividad / excursión",
  esim: "eSIM",
  visa: "Visado",
  fees: "Tasas / gestión",
  custom: "Otro servicio",
};

const statusLabels: Record<string, string> = {
  draft: "Borrador",
  internal_review: "Revisión interna",
  sent: "Enviado",
  accepted: "Aceptado",
  rejected: "Rechazado",
  expired: "Expirado",
};

function numberValue(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown, currency: string) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(numberValue(value));
}

function relation(value: unknown): RecordRow | null {
  if (Array.isArray(value)) return value[0] && typeof value[0] === "object" ? value[0] as RecordRow : null;
  return value && typeof value === "object" ? value as RecordRow : null;
}

function versionsOf(proposal: RecordRow) {
  const versions = Array.isArray(proposal.proposal_versions) ? proposal.proposal_versions as Version[] : [];
  return [...versions].sort((left, right) => numberValue(right.version_number) - numberValue(left.version_number));
}

function linesOf(version?: Version | null) {
  return Array.isArray(version?.budget_lines) ? version.budget_lines : [];
}

function versionTotals(version?: Version | null) {
  const lines = linesOf(version);
  const cost = numberValue(version?.total_cost_budget) || lines.reduce((sum, line) => sum + numberValue(line.cost_budget), 0);
  const sale = numberValue(version?.total_sale) || lines.reduce((sum, line) => sum + numberValue(line.sale_price), 0);
  const realCost = numberValue(version?.total_cost_real) || lines.reduce((sum, line) => sum + numberValue(line.cost_real ?? line.cost_budget), 0);
  const profit = numberValue(version?.budgeted_profit) || sale - cost;
  const realProfit = numberValue(version?.real_profit) || sale - realCost;
  return {
    cost,
    sale,
    realCost,
    profit,
    realProfit,
    margin: sale ? (profit / sale) * 100 : 0,
    realMargin: sale ? (realProfit / sale) * 100 : 0,
  };
}

export function BudgetReadOnlyWorkspace({ proposalInput }: { proposalInput: unknown }) {
  const proposal = proposalInput as RecordRow;
  const versions = versionsOf(proposal);
  const version = versions[0] || null;
  const lines = linesOf(version);
  const totals = versionTotals(version);
  const caseRow = relation(proposal.cases);
  const client = relation(caseRow?.clients);
  const currency = String(caseRow?.currency || "EUR");

  return <div className="budget-page">
    <section className="card form-warning">
      <strong>Modo consulta</strong>
      <p>Tu rol puede revisar el presupuesto y su histórico, pero no modificar líneas, versiones ni estados.</p>
    </section>

    <section className="card budget-workspace">
      <div className="budget-workspace-header">
        <div>
          <span className="eyebrow">{String(caseRow?.case_code || "Presupuesto")}</span>
          <h2>{String(client?.display_name || "Cliente")} · {String(caseRow?.destination || "Sin destino")}</h2>
          <p>Versión {numberValue(version?.version_number) || 1} · {statusLabels[String(proposal.status || version?.status || "draft")] || String(proposal.status || version?.status || "Borrador")} · {lines.length} servicios · {currency}</p>
        </div>
        <div className="budget-header-actions">
          {caseRow?.id ? <a className="btn secondary" href={`/expedientes?caseId=${encodeURIComponent(String(caseRow.id))}`}>Abrir expediente</a> : null}
        </div>
      </div>

      <div className="budget-totals">
        <div><span>Coste presupuestado</span><strong>{money(totals.cost, currency)}</strong></div>
        <div><span>Venta</span><strong>{money(totals.sale, currency)}</strong></div>
        <div><span>Beneficio previsto</span><strong>{money(totals.profit, currency)}</strong></div>
        <div><span>Margen previsto</span><strong>{totals.margin.toFixed(1)}%</strong></div>
        <div><span>Coste real / estimado</span><strong>{money(totals.realCost, currency)}</strong></div>
        <div><span>Beneficio real / estimado</span><strong>{money(totals.realProfit, currency)}</strong><small> · margen {totals.realMargin.toFixed(1)}%</small></div>
      </div>

      <section className="budget-lines-panel">
        <div className="panel-head"><div><h3>Servicios del presupuesto</h3><p>Vista de la versión más reciente.</p></div></div>
        {lines.length ? <div className="table-scroll"><table>
          <thead><tr><th>Tipo / descripción</th><th>Fechas</th><th>Proveedor</th><th>Coste previsto / real</th><th>Venta</th><th>Compra</th></tr></thead>
          <tbody>{lines.map((line, index) => <tr key={String(line.id || index)}>
            <td><strong>{serviceLabels[String(line.service_type_code || "custom")] || String(line.service_type_code || "Servicio")}</strong><br />{String(line.description_public || "—")}</td>
            <td>{String(line.start_date || "—")}<br /><small>{String(line.end_date || "")}</small></td>
            <td>{String(line.supplier_name || "—")}<br /><small>{String(line.destination_segment || "")}</small></td>
            <td>{money(line.cost_budget, currency)}{line.cost_real !== null && line.cost_real !== undefined ? <><br /><small>Real: {money(line.cost_real, currency)}</small></> : null}</td>
            <td>{money(line.sale_price, currency)}</td>
            <td>{line.creates_expected_purchase === false ? "No" : "Sí"}</td>
          </tr>)}</tbody>
        </table></div> : <div className="empty-state"><h3>Presupuesto vacío</h3><p>Esta versión todavía no contiene servicios.</p></div>}
      </section>

      <section className="budget-versions-panel">
        <h3>Histórico de versiones</h3>
        <div className="table-scroll"><table>
          <thead><tr><th>Versión</th><th>Estado</th><th>Fecha</th><th>Venta</th><th>Coste</th><th>Bloqueada</th></tr></thead>
          <tbody>{versions.map((item, index) => {
            const itemTotals = versionTotals(item);
            return <tr key={String(item.id || index)}><td>v{numberValue(item.version_number) || 1}</td><td>{statusLabels[String(item.status || "draft")] || String(item.status || "—")}</td><td>{item.created_at ? new Date(item.created_at).toLocaleDateString("es-ES") : "—"}</td><td>{money(itemTotals.sale, currency)}</td><td>{money(itemTotals.cost, currency)}</td><td>{item.locked ? "Sí" : "No"}</td></tr>;
          })}</tbody>
        </table></div>
      </section>
    </section>
  </div>;
}
