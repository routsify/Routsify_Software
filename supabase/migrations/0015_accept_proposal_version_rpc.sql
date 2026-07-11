create or replace function public.accept_proposal_version(target_version uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_version public.proposal_versions%rowtype;
  v_proposal public.proposals%rowtype;
  v_now timestamptz := now();
begin
  select * into v_version
  from public.proposal_versions
  where id = target_version
  for update;

  if not found then
    raise exception 'proposal_version_not_found';
  end if;

  select * into v_proposal
  from public.proposals
  where id = v_version.proposal_id
  for update;

  if not found then
    raise exception 'proposal_not_found';
  end if;

  if coalesce(v_version.total_sale, 0) <= 0 then
    raise exception 'proposal_total_required';
  end if;

  if not exists (
    select 1 from public.budget_lines where proposal_version_id = target_version
  ) then
    raise exception 'proposal_requires_lines';
  end if;

  update public.proposal_versions
  set status = 'accepted', accepted_at = v_now, locked_at = v_now, locked = true
  where id = target_version;

  update public.proposals
  set status = 'accepted',
      current_version_id = target_version,
      public_token_hash = null,
      public_token_expires_at = null,
      updated_at = v_now
  where id = v_proposal.id;

  update public.cases
  set status = 'proposal_accepted',
      accepted_value = v_version.total_sale,
      next_action = 'Preparar contrato',
      updated_at = v_now,
      last_event_at = v_now
  where id = v_proposal.case_id;

  insert into public.expected_purchases(
    organization_id,
    case_id,
    proposal_version_id,
    budget_line_id,
    supplier_id,
    status,
    expected_amount,
    amount,
    currency,
    supplier_name,
    service
  )
  select
    line.organization_id,
    v_proposal.case_id,
    target_version,
    line.id,
    line.supplier_id,
    'expected'::public.expected_purchase_status,
    line.cost_budget,
    line.cost_budget,
    'EUR',
    line.supplier_name,
    line.description_public
  from public.budget_lines line
  where line.proposal_version_id = target_version
    and coalesce(line.cost_budget, 0) > 0
  on conflict (case_id, budget_line_id, supplier_id) do nothing;

  return jsonb_build_object(
    'proposal_id', v_proposal.id,
    'version_id', target_version,
    'accepted_at', v_now
  );
end;
$$;