create or replace function public.accept_proposal_version(target_version uuid)
returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_version public.proposal_versions%rowtype;
  v_proposal public.proposals%rowtype;
  v_now timestamptz := now();
  v_purchase_count integer := 0;
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

  if v_proposal.status = 'accepted' and v_proposal.current_version_id is distinct from target_version then
    raise exception 'accepted_proposal_locked';
  end if;

  if coalesce(v_version.total_sale, 0) <= 0 then
    raise exception 'proposal_total_required';
  end if;

  if not exists (select 1 from public.budget_lines where proposal_version_id = target_version) then
    raise exception 'proposal_requires_lines';
  end if;

  update public.proposal_versions
  set status = 'accepted', accepted_at = coalesce(accepted_at, v_now), locked_at = coalesce(locked_at, v_now), locked = true
  where id = target_version;

  update public.proposals
  set status = 'accepted', current_version_id = target_version,
      public_token_hash = null, public_token_expires_at = null, updated_at = v_now
  where id = v_proposal.id;

  update public.cases
  set status = 'proposal_accepted', accepted_value = v_version.total_sale,
      next_action = 'Preparar contrato', updated_at = v_now, last_event_at = v_now
  where id = v_proposal.case_id;

  insert into public.expected_purchases (
    organization_id,
    case_id,
    proposal_version_id,
    budget_line_id,
    supplier_id,
    supplier_name,
    service,
    expected_amount,
    amount,
    currency,
    status,
    review_notes
  )
  select
    line.organization_id,
    v_proposal.case_id,
    target_version,
    line.id,
    line.supplier_id,
    nullif(line.supplier_name, ''),
    line.description_public,
    line.cost_budget,
    line.cost_budget,
    'EUR',
    'expected'::public.expected_purchase_status,
    'Generada automáticamente al aceptar el presupuesto.'
  from public.budget_lines line
  where line.proposal_version_id = target_version
    and (coalesce(line.cost_budget, 0) > 0 or nullif(line.supplier_name, '') is not null)
    and not exists (
      select 1
      from public.expected_purchases existing
      where existing.budget_line_id = line.id
        and existing.proposal_version_id = target_version
    );

  get diagnostics v_purchase_count = row_count;

  return jsonb_build_object(
    'proposal_id', v_proposal.id,
    'version_id', target_version,
    'accepted_at', v_now,
    'expected_purchases_created', v_purchase_count
  );
end;
$$;

create or replace function public.prevent_unaccept_accepted_proposal()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if old.status = 'accepted' and new.status is distinct from 'accepted' then
    raise exception 'accepted_proposal_locked';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_unaccept_accepted_proposal on public.proposals;
create trigger trg_prevent_unaccept_accepted_proposal
before update on public.proposals
for each row
execute function public.prevent_unaccept_accepted_proposal();

create or replace function public.prevent_unlock_accepted_version()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if old.status = 'accepted' and (new.status is distinct from 'accepted' or new.locked is distinct from true) then
    raise exception 'accepted_version_locked';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_unlock_accepted_version on public.proposal_versions;
create trigger trg_prevent_unlock_accepted_version
before update on public.proposal_versions
for each row
execute function public.prevent_unlock_accepted_version();

