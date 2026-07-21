create or replace function public.create_or_get_case_proposal(
  target_org uuid,
  target_case uuid,
  target_actor uuid default null::uuid
)
returns table(proposal_id uuid, proposal_version_id uuid, created boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_proposal_id uuid;
  v_version_id uuid;
  v_created boolean := false;
begin
  if target_org is null or target_case is null then
    raise exception 'organization_and_case_required';
  end if;

  if not exists (
    select 1
    from public.cases as c
    where c.id = target_case
      and c.organization_id = target_org
  ) then
    raise exception 'case_not_found';
  end if;

  select p.id, p.current_version_id
    into v_proposal_id, v_version_id
  from public.proposals as p
  where p.organization_id = target_org
    and p.case_id = target_case
  for update;

  if v_proposal_id is null then
    insert into public.proposals (organization_id, case_id, status)
    values (target_org, target_case, 'draft')
    on conflict (organization_id, case_id) do nothing
    returning proposals.id, proposals.current_version_id
      into v_proposal_id, v_version_id;

    if v_proposal_id is null then
      select p.id, p.current_version_id
        into v_proposal_id, v_version_id
      from public.proposals as p
      where p.organization_id = target_org
        and p.case_id = target_case
      for update;
    else
      v_created := true;
    end if;
  end if;

  if v_version_id is null then
    select pv.id
      into v_version_id
    from public.proposal_versions as pv
    where pv.organization_id = target_org
      and pv.proposal_id = v_proposal_id
    order by pv.version_number desc
    limit 1;

    if v_version_id is null then
      insert into public.proposal_versions (
        organization_id,
        proposal_id,
        version_number,
        status,
        total_sale,
        total_cost,
        total_cost_budget,
        budgeted_profit
      ) values (
        target_org,
        v_proposal_id,
        1,
        'draft',
        0,
        0,
        0,
        0
      ) returning proposal_versions.id into v_version_id;
    end if;

    update public.proposals as p
      set current_version_id = v_version_id,
          updated_at = now()
    where p.id = v_proposal_id
      and p.organization_id = target_org;
  end if;

  if v_created then
    update public.cases as c
      set status = 'budget_draft',
          next_action = 'Completar presupuesto',
          updated_at = now()
    where c.id = target_case
      and c.organization_id = target_org;

    insert into public.timeline_events (
      organization_id,
      case_id,
      event_type,
      title,
      payload,
      created_by
    ) values (
      target_org,
      target_case,
      'proposal.created',
      'Presupuesto creado',
      jsonb_build_object(
        'proposal_id', v_proposal_id,
        'proposal_version_id', v_version_id
      ),
      target_actor
    );
  end if;

  return query
  select v_proposal_id, v_version_id, v_created;
end;
$function$;

