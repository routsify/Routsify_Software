"use client";

import { FormEvent, useState } from "react";
import { usePermission } from "@/components/PermissionProvider";

type Scenario = {
  id: string;
  proposal_id: string;
  source_version_id: string;
  name: string;
  scenario_type: "economical" | "recommended" | "premium" | "custom";
  description?: string | null;
  target_margin_pct: number | string;
  total_cost: number | string;
  total_sale: number | string;
  profit: number | string;
  margin_pct: number | string;
  status: string;
  applied_at?: string | null;
};

type Draft = { name: string; scenario_type: Scenario["scenario_type"]; target_margin_pct: number; description: string };
const presets: Draft[] = [
  { name: "Opción económica", scenario_type: "economical", target_margin_pct: 15, description: "Alternativa ajustada para clientes sensibles al precio." },
  { name: "Opción recomendada", scenario_type: "recommended", target_margin_pct: 22, description: "Equilibrio entre precio, servicio y rentabilidad." },
  { name: "Opción premium", scenario_type: "premium", target_margin_pct: 30, description: "Alternativa de mayor valor y nivel de servicio." },
];
const emptyDraft: Draft = { name: "Escenario personalizado", scenario_type: "custom", target_margin_pct: 22, description: "" };

function numberValue(value: unknown) { const parsed = Number(value || 0); return Number.isFinite(parsed) ? parsed : 0; }
function money(value: unknown, currency: string) { return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(numberValue(value)); }
function typeLabel(value: Scenario["scenario_type"]) { return ({ economical: "Económica", recommended: "Recomendada", premium: "Premium", custom: "Personalizada" } as const)[value]; }
function errorText(error: string) {
  if (error === "scenario_source_has_no_lines") return "Añade servicios al presupuesto antes de crear escenarios.";
  if (error === "current_version_not_editable") return "El escenario solo puede aplicarse a una versión editable.";
  if (error === "scenario_has_generated_purchases") return "Este borrador ya ha generado compras. Crea una nueva versión antes de aplicar otro escenario.";
  if (error === "invalid_target_margin") return "El margen debe estar entre 0 % y 80 %.";
  return error || "No se pudo completar la operación.";
}

export function ProposalScenariosPanel({ proposalId, sourceVersionId, currency, initialScenarios, currentEditable }: { proposalId: string; sourceVersionId: string; currency: string; initialScenarios: Scenario[]; currentEditable: boolean }) {
  const canManage = usePermission("budgets.manage");
  const [scenarios, setScenarios] = useState(initialScenarios);
  const [draft, setDraft] = useState(emptyDraft);
  const [showForm, setShowForm] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch(`/api/routsify/proposals/${encodeURIComponent(proposalId)}/scenarios`, { cache: "no-store" });
    const result = await response.json().catch(() => null);
    if (response.ok && result?.ok) setScenarios(result.data as Scenario[]);
  }
  async function createScenario(value: Draft) {
    const response = await fetch(`/api/routsify/proposals/${encodeURIComponent(proposalId)}/scenarios`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...value, source_version_id: sourceVersionId }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) throw new Error(String(result?.error || "scenario_create_failed"));
    return result.data as Scenario;
  }
  async function generatePack() {
    setWorking(true); setMessage(null);
    try {
      for (const preset of presets) await createScenario(preset);
      await refresh();
      setMessage("Se han generado las tres alternativas sobre la versión actual.");
    } catch (error) {
      setMessage(errorText(error instanceof Error ? error.message : "scenario_create_failed"));
    } finally { setWorking(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWorking(true); setMessage(null);
    try {
      await createScenario(draft); await refresh(); setDraft(emptyDraft); setShowForm(false); setMessage("Escenario creado.");
    } catch (error) { setMessage(errorText(error instanceof Error ? error.message : "scenario_create_failed")); }
    finally { setWorking(false); }
  }
  async function applyScenario(scenario: Scenario) {
    if (!window.confirm(`Aplicar “${scenario.name}” al borrador actual? Se sustituirán sus líneas por esta simulación.`)) return;
    setWorking(true); setMessage(null);
    const response = await fetch(`/api/routsify/proposals/${encodeURIComponent(proposalId)}/scenarios/${encodeURIComponent(scenario.id)}/apply`, { method: "POST" });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) { setWorking(false); setMessage(errorText(String(result?.error || "scenario_apply_failed"))); return; }
    setMessage("Escenario aplicado. Actualizando el presupuesto...");
    window.location.reload();
  }

  return <section className="card proposal-scenarios">
    <div className="panel-head"><div><div className="eyebrow">Simulador interno</div><h2>Escenarios de presupuesto</h2><p>Compara precios y márgenes antes de enviar una propuesta. Los escenarios no crean expedientes, compras ni documentos en Holded.</p></div>{canManage ? <div className="form-actions"><button className="btn secondary" type="button" onClick={() => setShowForm((value) => !value)} disabled={working}>{showForm ? "Cerrar" : "Escenario personalizado"}</button><button className="btn" type="button" onClick={() => void generatePack()} disabled={working}>{working ? "Calculando..." : "Generar 3 alternativas"}</button></div> : null}</div>
    {message ? <p className="client-message" role="status">{message}</p> : null}
    {!currentEditable ? <div className="form-warning"><strong>Versión no editable</strong><p>Puedes comparar escenarios, pero para aplicar uno debes crear una nueva versión del presupuesto.</p></div> : null}
    {showForm && canManage ? <form className="form scenario-form" onSubmit={submit}><div className="grid grid-3"><label>Nombre<input className="input" required value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label><label>Tipo<select value={draft.scenario_type} onChange={(event) => setDraft((current) => ({ ...current, scenario_type: event.target.value as Draft["scenario_type"] }))}><option value="economical">Económica</option><option value="recommended">Recomendada</option><option value="premium">Premium</option><option value="custom">Personalizada</option></select></label><label>Margen objetivo %<input className="input" type="number" min={0} max={80} step="0.1" value={draft.target_margin_pct} onChange={(event) => setDraft((current) => ({ ...current, target_margin_pct: Number(event.target.value) }))} /></label></div><label>Descripción<textarea rows={3} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label><div className="form-actions"><button className="btn secondary" type="button" onClick={() => setShowForm(false)}>Cancelar</button><button className="btn" type="submit" disabled={working}>Crear escenario</button></div></form> : null}
    {scenarios.length === 0 ? <div className="empty-state"><h3>Sin escenarios</h3><p>Genera las alternativas económica, recomendada y premium para compararlas.</p></div> : <div className="scenario-grid">{scenarios.map((scenario) => <article className={`scenario-card scenario-${scenario.scenario_type} ${scenario.status === "selected" ? "scenario-selected" : ""}`} key={scenario.id}><div className="scenario-head"><div><span className="badge">{typeLabel(scenario.scenario_type)}</span><h3>{scenario.name}</h3></div>{scenario.status === "selected" ? <span className="status-pill status-done">Aplicado</span> : null}</div><p>{scenario.description || "Simulación sobre la versión actual."}</p><dl><div><dt>Venta</dt><dd>{money(scenario.total_sale, currency)}</dd></div><div><dt>Coste</dt><dd>{money(scenario.total_cost, currency)}</dd></div><div><dt>Beneficio</dt><dd>{money(scenario.profit, currency)}</dd></div><div><dt>Margen</dt><dd>{numberValue(scenario.margin_pct).toFixed(1)} %</dd></div></dl>{canManage ? <button className={scenario.status === "selected" ? "btn secondary" : "btn"} type="button" onClick={() => void applyScenario(scenario)} disabled={working || !currentEditable || scenario.status === "selected"}>{scenario.status === "selected" ? "Escenario aplicado" : "Aplicar al borrador"}</button> : null}</article>)}</div>}
  </section>;
}
