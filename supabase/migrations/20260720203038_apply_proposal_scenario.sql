create or replace function public.apply_proposal_scenario(
  target_scenario uuid,
  target_organization uuid,
  actor uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  scenario_row public.proposal_scenarios;
  proposal_row public.proposals;
  version_row public.proposal_versions;
  line jsonb;
  inserted_lines integer := 0;
  purchase_count integer := 0;
  now_value timestamptz := now();
begin
  select * into scenario_row
  from public.proposal_scenarios
  where id = target_scenario and organization_id = target_organization
  for update;
  if scenario_row.id is null then raise exception 'scenario_not_found'; end if;

  select * into proposal_row
  from public.proposals
  where id = scenario_row.proposal_id and organization_id = target_organization
  for update;
  if proposal_row.id is null then raise exception 'proposal_not_found'; end if;
  if proposal_row.current_version_id is null then raise exception 'proposal_version_not_found'; end if;

  select * into version_row
  from public.proposal_versions
  where id = proposal_row.current_version_id and proposal_id = proposal_row.id and organization_id = target_organization
  for update;
  if version_row.id is null then raise exception 'proposal_version_not_found'; end if;
  if coalesce(version_row.locked, false) or version_row.status not in ('draft','internal_review') then
    raise exception 'current_version_not_editable';
  end if;

  select count(*) into purchase_count
  from public.expected_purchases
  where organization_id = target_organization
    and proposal_version_id = version_row.id
    and coalesce(active, true) = true
    and status not in ('not_required','cancelled');
  if purchase_count > 0 then raise exception 'scenario_has_generated_purchases'; end if;

  delete from public.budget_lines where proposal_version_id = version_row.id;

  for line in select value from jsonb_array_elements(scenario_row.lines_snapshot)
  loop
    insert into public.budget_lines (
      organization_id, proposal_version_id, stable_line_id, service_type_id, service_type_code,
      description_internal, description_public, supplier_id, supplier_name, destination_segment,
      start_date, end_date, cost_budget, cost_real, cost_real_source, margin_applied,
      margin_rule_id, margin_snapshot, origin_margin, formula_version_id, sale_price,
      creates_expected_purchase, included, sort_order
    ) values (
      target_organization,
      version_row.id,
      coalesce(nullif(line->>'stable_line_id',''), gen_random_uuid()::text),
      nullif(line->>'service_type_id','')::uuid,
      nullif(line->>'service_type_code',''),
      nullif(line->>'description_internal',''),
      coalesce(nullif(line->>'description_public',''), 'Servicio'),
      nullif(line->>'supplier_id','')::uuid,
      nullif(line->>'supplier_name',''),
      nullif(line->>'destination_segment',''),
      nullif(line->>'start_date','')::date,
      nullif(line->>'end_date','')::date,
      coalesce((line->>'cost_budget')::numeric, 0),
      null,
      null,
      coalesce((line->>'margin_applied')::numeric, 0),
      nullif(line->>'margin_rule_id','')::uuid,
      coalesce(line->'margin_snapshot', '{}'::jsonb),
      nullif(line->>'origin_margin','')::numeric,
      nullif(line->>'formula_version_id','')::uuid,
      coalesce((line->>'sale_price')::numeric, 0),
      coalesce((line->>'creates_expected_purchase')::boolean, true),
      coalesce((line->>'included')::boolean, true),
      coalesce((line->>'sort_order')::integer, inserted_lines)
    );
    inserted_lines := inserted_lines + 1;
  end loop;

  update public.proposal_versions
  set total_cost = scenario_row.total_cost,
      total_cost_budget = scenario_row.total_cost,
      total_sale = scenario_row.total_sale,
      budgeted_profit = scenario_row.profit,
      financial_summary_json = jsonb_build_object(
        'scenario_id', scenario_row.id,
        'scenario_type', scenario_row.scenario_type,
        'target_margin_pct', scenario_row.target_margin_pct,
        'total_cost', scenario_row.total_cost,
        'total_sale', scenario_row.total_sale,
        'profit', scenario_row.profit,
        'margin_pct', scenario_row.margin_pct
      ),
      updated_at = now_value
  where id = version_row.id;

  update public.proposal_scenarios
  set status = case when id = scenario_row.id then 'selected' else 'draft' end,
      applied_at = case when id = scenario_row.id then now_value else applied_at end,
      applied_by = case when id = scenario_row.id then actor else applied_by end,
      updated_at = now_value
  where proposal_id = proposal_row.id and organization_id = target_organization and status <> 'archived';

  update public.proposals
  set status = 'draft', public_token_hash = null, public_token_expires_at = null, updated_at = now_value
  where id = proposal_row.id;

  update public.cases
  set status = 'budget_draft', next_action = 'Revisar el escenario aplicado al presupuesto', updated_at = now_value
  where id = proposal_row.case_id and organization_id = target_organization;

  insert into public.timeline_events(organization_id, case_id, event_type, title, payload, created_by)
  values (target_organization, proposal_row.case_id, 'proposal.scenario_applied', 'Escenario aplicado al presupuesto', jsonb_build_object('proposal_id', proposal_row.id, 'version_id', version_row.id, 'scenario_id', scenario_row.id, 'scenario_name', scenario_row.name), actor);

  insert into public.audit_log(organization_id, actor_id, entity_type, entity_id, action, before_data, after_data)
  values (target_organization, actor, 'proposal_scenario', scenario_row.id, 'proposal_scenario.applied', jsonb_build_object('version_id', version_row.id), jsonb_build_object('lines', inserted_lines, 'total_sale', scenario_row.total_sale, 'margin_pct', scenario_row.margin_pct));

  return jsonb_build_object('scenario_id', scenario_row.id, 'proposal_id', proposal_row.id, 'version_id', version_row.id, 'lines', inserted_lines, 'total_cost', scenario_row.total_cost, 'total_sale', scenario_row.total_sale, 'profit', scenario_row.profit, 'margin_pct', scenario_row.margin_pct);
end;
$$;

revoke all on function public.apply_proposal_scenario(uuid, uuid, uuid) from public;
grant execute on function public.apply_proposal_scenario(uuid, uuid, uuid) to service_role;

