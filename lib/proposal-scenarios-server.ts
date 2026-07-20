import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type ProposalScenarioType = "economical" | "recommended" | "premium" | "custom";

type Row = Record<string, unknown>;

const TYPES = new Set<ProposalScenarioType>(["economical", "recommended", "premium", "custom"]);
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const numberValue = (value: unknown) => { const parsed = Number(value || 0); return Number.isFinite(parsed) ? parsed : 0; };
const text = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);

function scenarioLine(line: Row, targetMarginPct: number, index: number) {
  const included = line.included !== false;
  const cost = roundMoney(numberValue(line.cost_budget));
  const sale = included && cost > 0 ? roundMoney(cost / (1 - targetMarginPct / 100)) : included ? roundMoney(numberValue(line.sale_price)) : 0;
  return {
    stable_line_id: text(line.stable_line_id, 100),
    service_type_id: text(line.service_type_id, 50),
    service_type_code: text(line.service_type_code, 80),
    description_internal: text(line.description_internal, 2000),
    description_public: text(line.description_public, 2000) || "Servicio",
    supplier_id: text(line.supplier_id, 50),
    supplier_name: text(line.supplier_name, 200),
    destination_segment: text(line.destination_segment, 200),
    start_date: text(line.start_date, 10),
    end_date: text(line.end_date, 10),
    cost_budget: cost,
    margin_applied: targetMarginPct / 100,
    margin_rule_id: text(line.margin_rule_id, 50),
    margin_snapshot: line.margin_snapshot && typeof line.margin_snapshot === "object" ? line.margin_snapshot : {},
    origin_margin: targetMarginPct / 100,
    formula_version_id: text(line.formula_version_id, 50),
    sale_price: sale,
    creates_expected_purchase: line.creates_expected_purchase !== false,
    included,
    sort_order: Number.isFinite(Number(line.sort_order)) ? Number(line.sort_order) : index,
  };
}

export async function listProposalScenarios(organizationId: string, proposalId: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("proposal_scenarios")
    .select("id,proposal_id,source_version_id,name,scenario_type,description,target_margin_pct,total_cost,total_sale,profit,margin_pct,status,applied_at,created_at,updated_at")
    .eq("organization_id", organizationId)
    .eq("proposal_id", proposalId)
    .neq("status", "archived")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createProposalScenario(input: {
  organizationId: string;
  proposalId: string;
  actorId: string | null;
  name: unknown;
  scenarioType: unknown;
  description?: unknown;
  targetMarginPct: unknown;
  sourceVersionId?: unknown;
}) {
  const name = text(input.name, 120);
  const scenarioType = text(input.scenarioType, 30) as ProposalScenarioType;
  const targetMarginPct = Number(input.targetMarginPct);
  if (name.length < 2) return { ok: false as const, error: "scenario_name_required", status: 400 };
  if (!TYPES.has(scenarioType)) return { ok: false as const, error: "invalid_scenario_type", status: 400 };
  if (!Number.isFinite(targetMarginPct) || targetMarginPct < 0 || targetMarginPct > 80) return { ok: false as const, error: "invalid_target_margin", status: 400 };

  const db = getSupabaseAdminClient();
  const { data: proposal, error: proposalError } = await db.from("proposals").select("id,case_id,current_version_id").eq("id", input.proposalId).eq("organization_id", input.organizationId).maybeSingle();
  if (proposalError) return { ok: false as const, error: proposalError.message, status: 400 };
  if (!proposal) return { ok: false as const, error: "proposal_not_found", status: 404 };
  const sourceVersionId = text(input.sourceVersionId, 50) || String(proposal.current_version_id || "");
  if (!sourceVersionId) return { ok: false as const, error: "proposal_version_not_found", status: 404 };

  const { data: version, error: versionError } = await db.from("proposal_versions").select("id,version_number,status,locked").eq("id", sourceVersionId).eq("proposal_id", input.proposalId).eq("organization_id", input.organizationId).maybeSingle();
  if (versionError) return { ok: false as const, error: versionError.message, status: 400 };
  if (!version) return { ok: false as const, error: "proposal_version_not_found", status: 404 };

  const { data: sourceLines, error: linesError } = await db.from("budget_lines").select("*").eq("proposal_version_id", sourceVersionId).eq("organization_id", input.organizationId).order("sort_order", { ascending: true });
  if (linesError) return { ok: false as const, error: linesError.message, status: 400 };
  if (!sourceLines?.length) return { ok: false as const, error: "scenario_source_has_no_lines", status: 409 };

  const snapshot = (sourceLines as Row[]).map((line, index) => scenarioLine(line, targetMarginPct, index));
  const included = snapshot.filter((line) => line.included !== false);
  const totalCost = roundMoney(included.reduce((sum, line) => sum + numberValue(line.cost_budget), 0));
  const totalSale = roundMoney(included.reduce((sum, line) => sum + numberValue(line.sale_price), 0));
  const profit = roundMoney(totalSale - totalCost);
  const marginPct = totalSale > 0 ? roundMoney((profit / totalSale) * 100) : 0;
  const now = new Date().toISOString();

  if (scenarioType !== "custom") {
    await db.from("proposal_scenarios").update({ status: "archived", updated_at: now }).eq("organization_id", input.organizationId).eq("proposal_id", input.proposalId).eq("scenario_type", scenarioType).eq("status", "draft");
  }

  const { data, error } = await db.from("proposal_scenarios").insert({
    organization_id: input.organizationId,
    proposal_id: input.proposalId,
    source_version_id: sourceVersionId,
    name,
    scenario_type: scenarioType,
    description: text(input.description, 1000) || null,
    target_margin_pct: targetMarginPct,
    total_cost: totalCost,
    total_sale: totalSale,
    profit,
    margin_pct: marginPct,
    lines_snapshot: snapshot,
    status: "draft",
    created_by: input.actorId,
  }).select("id,proposal_id,source_version_id,name,scenario_type,description,target_margin_pct,total_cost,total_sale,profit,margin_pct,status,applied_at,created_at,updated_at").single();
  if (error) return { ok: false as const, error: error.message, status: 400 };

  await db.from("audit_log").insert({ organization_id: input.organizationId, actor_id: input.actorId, entity_type: "proposal_scenario", entity_id: data.id, action: "proposal_scenario.created", after_data: { ...data, lines: snapshot.length } });
  await db.from("timeline_events").insert({ organization_id: input.organizationId, case_id: proposal.case_id, event_type: "proposal.scenario_created", title: `Creado escenario ${name}`, payload: { proposal_id: input.proposalId, scenario_id: data.id, scenario_type: scenarioType, target_margin_pct: targetMarginPct, source_version: version.version_number }, created_by: input.actorId });
  return { ok: true as const, data, status: 201 };
}
