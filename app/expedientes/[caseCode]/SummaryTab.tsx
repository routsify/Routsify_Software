import type { CaseRow, PaymentRow, ProposalRow, PurchaseRow } from "./workspace-types";
import { money, numberValue, formatDate } from "./workspace-types";

const serviceLabels: Record<string, string> = { flight: "Vuelo", accommodation: "Alojamiento", transfer: "Traslado", rail: "Tren", ferry: "Ferry", rental_car: "Coche", insurance: "Seguro", activity: "Actividad", esim: "eSIM", visa: "Visado", fees: "Tasas", custom: "Servicio" };

export function SummaryTab({ caseRow, payments, proposals, purchases, onTab }: { caseRow: CaseRow; payments: PaymentRow[]; proposals: ProposalRow[]; purchases: PurchaseRow[]; onTab: (tab: string) => void }) {
  const paid = payments.filter((item) => ["confirmed", "paid", "received"].includes(String(item.status))).reduce((sum, item) => sum + numberValue(item.amount), 0);
  const accepted = numberValue(caseRow.accepted_value);
  const percentage = accepted > 0 ? Math.min((paid / accepted) * 100, 100) : 0;
  const pendingPurchases = purchases.filter((item) => !["approved", "not_required", "cancelled"].includes(String(item.status))).length;
  const proposal = proposals.find((item) => item.status === "accepted") || proposals[0];
  const versions = proposal?.proposal_versions || [];
  const latest = versions.find((item) => item.id === proposal?.current_version_id) || [...versions].sort((a, b) => Number(b.version_number || 0) - Number(a.version_number || 0))[0] || null;
  const acceptedLines = [...(latest?.budget_lines || [])].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  const currency = caseRow.currency || "EUR";

  return <section className="workspace-grid">
    <div className="card"><div className="eyebrow">Expediente</div><h2>{caseRow.title || caseRow.case_code}</h2><table><tbody><tr><th>Cliente</th><td>{caseRow.clients?.display_name || "—"}</td></tr><tr><th>Destino</th><td>{caseRow.destination || "—"}</td></tr><tr><th>Fechas</th><td>{formatDate(caseRow.trip_start)} → {formatDate(caseRow.trip_end)}</td></tr><tr><th>Estado</th><td>{caseRow.status || "—"}</td></tr><tr><th>Próxima acción</th><td>{caseRow.next_action || "—"}</td></tr></tbody></table></div>
    <div className="card"><div className="eyebrow">Situación económica</div><h2>{money(accepted, currency)}</h2><p>Valor aceptado</p><div className="progress"><span style={{ width: `${percentage}%` }} /></div><p>{money(paid, currency)} cobrado · {money(Math.max(accepted - paid, 0), currency)} pendiente</p><div className="side-actions"><a className="quick-action" href={`/propuestas?caseId=${caseRow.id}`}>Abrir presupuesto <span>→</span></a><button className="quick-action" type="button" onClick={() => onTab("contrato")}>Contrato y pagos <span>→</span></button><button className="quick-action" type="button" onClick={() => onTab("compras")}>{pendingPurchases} compras pendientes <span>→</span></button></div></div>
    <div className="card"><div className="eyebrow">Presupuesto actual</div><h2>{proposal ? `Versión ${latest?.version_number || 1}` : "Sin presupuesto"}</h2><p>{proposal ? `${proposal.status || "draft"} · ${money(latest?.total_sale || 0, currency)}` : "Crea el presupuesto desde el módulo Presupuestos."}</p></div>
    <div className="card"><div className="eyebrow">Contacto</div><h2>{caseRow.clients?.display_name || "Cliente"}</h2><p>{caseRow.clients?.email || "Sin email"}<br />{caseRow.clients?.phone || "Sin teléfono"}</p><p>{caseRow.clients?.tax_id ? "Datos fiscales identificados" : "Faltan datos fiscales"}</p></div>
    <div className="card workspace-wide"><div className="panel-head"><div><div className="eyebrow">Información precontractual aceptada</div><h2>Servicios incluidos</h2><p>Snapshot de la versión aceptada; no se modifica al editar futuras versiones.</p></div><span className="badge">{acceptedLines.length} servicios</span></div>{acceptedLines.length ? <div className="table-scroll"><table><thead><tr><th>Servicio</th><th>Descripción</th><th>Proveedor / tramo</th><th>Fechas</th><th>Venta</th></tr></thead><tbody>{acceptedLines.map((line) => <tr key={line.id}><td>{serviceLabels[String(line.service_type_code || "custom")] || line.service_type_code || "Servicio"}</td><td><strong>{line.description_public || "Servicio de viaje"}</strong></td><td>{line.supplier_name || "—"}<br /><small>{line.destination_segment || ""}</small></td><td>{formatDate(line.start_date)} → {formatDate(line.end_date)}</td><td>{money(line.sale_price, currency)}</td></tr>)}</tbody></table></div> : <p>El expediente todavía no tiene una versión aceptada con servicios.</p>}</div>
  </section>;
}
