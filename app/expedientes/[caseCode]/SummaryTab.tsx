import type { CaseRow, PaymentRow, ProposalRow, PurchaseRow } from "./workspace-types";
import { money, numberValue, formatDate } from "./workspace-types";

export function SummaryTab({ caseRow, payments, proposals, purchases, onTab }: { caseRow: CaseRow; payments: PaymentRow[]; proposals: ProposalRow[]; purchases: PurchaseRow[]; onTab: (tab: string) => void }) {
  const paid = payments.filter((item) => item.status === "confirmed").reduce((sum, item) => sum + numberValue(item.amount), 0);
  const accepted = numberValue(caseRow.accepted_value);
  const percentage = accepted > 0 ? Math.min((paid / accepted) * 100, 100) : 0;
  const pendingPurchases = purchases.filter((item) => !["approved", "not_required", "cancelled"].includes(String(item.status))).length;
  const proposal = proposals[0];
  const latest = proposal?.proposal_versions ? [...proposal.proposal_versions].sort((a, b) => Number(b.version_number || 0) - Number(a.version_number || 0))[0] : null;

  return <section className="workspace-grid">
    <div className="card"><div className="eyebrow">Expediente</div><h2>{caseRow.title || caseRow.case_code}</h2><table><tbody><tr><th>Cliente</th><td>{caseRow.clients?.display_name || "—"}</td></tr><tr><th>Destino</th><td>{caseRow.destination || "—"}</td></tr><tr><th>Fechas</th><td>{formatDate(caseRow.trip_start)} → {formatDate(caseRow.trip_end)}</td></tr><tr><th>Estado</th><td>{caseRow.status || "—"}</td></tr><tr><th>Próxima acción</th><td>{caseRow.next_action || "—"}</td></tr></tbody></table></div>
    <div className="card"><div className="eyebrow">Situación económica</div><h2>{money(accepted, caseRow.currency || "EUR")}</h2><p>Valor aceptado</p><div className="progress"><span style={{ width: `${percentage}%` }} /></div><p>{money(paid)} cobrado · {money(Math.max(accepted - paid, 0))} pendiente</p><div className="side-actions"><a className="quick-action" href={`/propuestas?caseId=${caseRow.id}`}>Abrir presupuesto <span>→</span></a><button className="quick-action" type="button" onClick={() => onTab("contrato")}>Contrato y pagos <span>→</span></button><button className="quick-action" type="button" onClick={() => onTab("compras")}>{pendingPurchases} compras pendientes <span>→</span></button></div></div>
    <div className="card"><div className="eyebrow">Presupuesto actual</div><h2>{proposal ? `Versión ${latest?.version_number || 1}` : "Sin presupuesto"}</h2><p>{proposal ? `${proposal.status || "draft"} · ${money(latest?.total_sale || 0)}` : "Crea el presupuesto desde el módulo Presupuestos."}</p></div>
    <div className="card"><div className="eyebrow">Contacto</div><h2>{caseRow.clients?.display_name || "Cliente"}</h2><p>{caseRow.clients?.email || "Sin email"}<br />{caseRow.clients?.phone || "Sin teléfono"}</p><p>{caseRow.clients?.tax_id ? "Datos fiscales identificados" : "Faltan datos fiscales"}</p></div>
  </section>;
}
