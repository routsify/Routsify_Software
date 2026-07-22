-- Proposal revisions after acceptance, explicit contract version selection and
-- private AI itinerary imports.

alter table public.budget_lines
  add column if not exists requirement_level text not null default 'required',
  add column if not exists source_reference text,
  add column if not exists ai_generated boolean not null default false,
  add column if not exists ai_confidence numeric(5,4);

alter table public.budget_lines
  drop constraint if exists budget_lines_requirement_level_check;
alter table public.budget_lines
  add constraint budget_lines_requirement_level_check
  check (requirement_level in ('required', 'conditional', 'optional'));

alter table public.budget_lines
  drop constraint if exists budget_lines_ai_confidence_check;
alter table public.budget_lines
  add constraint budget_lines_ai_confidence_check
  check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ai-itinerary-imports', 'ai-itinerary-imports', false, 15728640, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.ai_import_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  proposal_version_id uuid not null references public.proposal_versions(id) on delete cascade,
  provider text not null default 'openai',
  model text not null,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  file_name text not null,
  file_sha256 text not null,
  prompt_sha256 text not null,
  response_id text,
  service_count integer not null default 0 check (service_count >= 0),
  warnings jsonb not null default '[]'::jsonb,
  error_code text,
  created_by uuid,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ai_import_runs_org_created_idx
  on public.ai_import_runs (organization_id, created_at desc);
create index if not exists ai_import_runs_version_idx
  on public.ai_import_runs (proposal_version_id, created_at desc);
create index if not exists ai_import_runs_case_idx
  on public.ai_import_runs (case_id);
create index if not exists ai_import_runs_proposal_idx
  on public.ai_import_runs (proposal_id);

alter table public.ai_import_runs enable row level security;
drop policy if exists ai_import_runs_select_scoped on public.ai_import_runs;
create policy ai_import_runs_select_scoped on public.ai_import_runs
for select to authenticated
using (
  organization_id = (select public.current_org_id())
  and (select public.current_app_role()) = any (array['admin','direction','sales']::public.app_role[])
);

revoke all on table public.ai_import_runs from public, anon, authenticated;
grant select, insert, update on table public.ai_import_runs to service_role;

create or replace function public.protect_accepted_proposal_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'accepted'
     and new.status is distinct from old.status
     and coalesce(current_setting('routsify.allow_proposal_revision', true), '') <> 'true'
  then
    raise exception 'accepted_proposal_cannot_be_reopened';
  end if;
  return new;
end;
$$;

create or replace function public.protect_locked_budget_lines()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_version uuid;
  is_locked boolean;
begin
  target_version := case when tg_op = 'DELETE' then old.proposal_version_id else new.proposal_version_id end;
  select locked or status = 'accepted'::public.proposal_version_status
    into is_locked
  from public.proposal_versions
  where id = target_version;

  if coalesce(is_locked, false) then
    if tg_op in ('INSERT', 'DELETE') then
      raise exception 'accepted_budget_lines_are_immutable';
    end if;
    if new.stable_line_id is distinct from old.stable_line_id
       or new.service_type_id is distinct from old.service_type_id
       or new.service_type_code is distinct from old.service_type_code
       or new.description_internal is distinct from old.description_internal
       or new.description_public is distinct from old.description_public
       or new.supplier_id is distinct from old.supplier_id
       or new.supplier_name is distinct from old.supplier_name
       or new.destination_segment is distinct from old.destination_segment
       or new.start_date is distinct from old.start_date
       or new.end_date is distinct from old.end_date
       or new.cost_budget is distinct from old.cost_budget
       or new.margin_applied is distinct from old.margin_applied
       or new.sale_price is distinct from old.sale_price
       or new.included is distinct from old.included
       or new.creates_expected_purchase is distinct from old.creates_expected_purchase
       or new.origin_margin is distinct from old.origin_margin
       or new.formula_version_id is distinct from old.formula_version_id
       or new.margin_snapshot is distinct from old.margin_snapshot
       or new.sort_order is distinct from old.sort_order
       or new.requirement_level is distinct from old.requirement_level
       or new.source_reference is distinct from old.source_reference
       or new.ai_generated is distinct from old.ai_generated
       or new.ai_confidence is distinct from old.ai_confidence
    then
      raise exception 'accepted_budget_lines_are_immutable';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.create_proposal_revision(
  target_org uuid,
  target_proposal uuid,
  source_version uuid,
  actor uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.proposals%rowtype;
  v_source public.proposal_versions%rowtype;
  v_created public.proposal_versions%rowtype;
  v_existing public.proposal_versions%rowtype;
  v_next_number integer;
  v_now timestamptz := now();
begin
  select * into v_proposal
  from public.proposals
  where id = target_proposal and organization_id = target_org
  for update;
  if not found then raise exception 'proposal_not_found'; end if;

  if exists (
    select 1 from public.contracts
    where organization_id = target_org
      and case_id = v_proposal.case_id
      and status = 'signed'
  ) then
    raise exception 'signed_contract_requires_amendment';
  end if;

  select * into v_source
  from public.proposal_versions
  where id = source_version
    and proposal_id = target_proposal
    and organization_id = target_org;
  if not found then raise exception 'source_proposal_version_not_found'; end if;

  select * into v_existing
  from public.proposal_versions
  where proposal_id = target_proposal
    and organization_id = target_org
    and locked = false
    and status in ('draft', 'internal_review')
  order by version_number desc
  limit 1;
  if found then raise exception 'editable_version_exists'; end if;

  select coalesce(max(version_number), 0) + 1
    into v_next_number
  from public.proposal_versions
  where proposal_id = target_proposal;

  insert into public.proposal_versions (
    organization_id, proposal_id, version_number, status, title, narrative,
    terms_snapshot, margin_snapshot, snapshot, total_sale, total_cost,
    total_cost_budget, total_cost_real, budgeted_profit, real_profit,
    real_margin_pct, cost_deviation, formula_version_id,
    margin_rules_snapshot_json, financial_summary_json, locked,
    locked_at, accepted_at, expires_at, created_at, updated_at
  ) values (
    target_org, target_proposal, v_next_number, 'draft', 'Versión ' || v_next_number,
    coalesce(v_source.narrative, '{}'::jsonb), v_source.terms_snapshot,
    coalesce(v_source.margin_snapshot, '{}'::jsonb),
    jsonb_build_object('revision_of', v_source.id, 'revision_created_at', v_now),
    v_source.total_sale, v_source.total_cost, v_source.total_cost_budget,
    v_source.total_cost_budget, v_source.budgeted_profit, v_source.budgeted_profit,
    v_source.real_margin_pct, 0, v_source.formula_version_id,
    '{}'::jsonb, coalesce(v_source.financial_summary_json, '{}'::jsonb), false,
    null, null, null, v_now, v_now
  ) returning * into v_created;

  insert into public.budget_lines (
    organization_id, proposal_version_id, stable_line_id, service_type_id,
    service_type_code, description_internal, description_public, supplier_id,
    supplier_name, destination_segment, start_date, end_date, cost_budget,
    cost_real, margin_applied, margin_rule_id, margin_snapshot, origin_margin,
    formula_version_id, sale_price, creates_expected_purchase, included,
    sort_order, requirement_level, source_reference, ai_generated, ai_confidence
  )
  select
    target_org, v_created.id, stable_line_id, service_type_id,
    service_type_code, description_internal, description_public, supplier_id,
    supplier_name, destination_segment, start_date, end_date, cost_budget,
    null, margin_applied, margin_rule_id, margin_snapshot, origin_margin,
    formula_version_id, sale_price, creates_expected_purchase, included,
    sort_order, requirement_level, source_reference, ai_generated, ai_confidence
  from public.budget_lines
  where proposal_version_id = v_source.id
  order by sort_order, created_at;

  perform set_config('routsify.allow_proposal_revision', 'true', true);
  update public.proposals
  set current_version_id = v_created.id,
      status = 'draft',
      public_token_hash = null,
      public_token_expires_at = null,
      updated_at = v_now
  where id = target_proposal and organization_id = target_org;

  update public.cases
  set next_action = 'Revisar y enviar la versión ' || v_next_number || ' del presupuesto',
      last_activity_at = v_now,
      updated_at = v_now
  where id = v_proposal.case_id and organization_id = target_org;

  insert into public.timeline_events (
    organization_id, case_id, event_type, title, payload, created_by
  ) values (
    target_org, v_proposal.case_id, 'proposal.version_created',
    'Creada versión ' || v_next_number || ' desde la versión ' || v_source.version_number,
    jsonb_build_object(
      'proposal_id', target_proposal,
      'version_id', v_created.id,
      'version_number', v_next_number,
      'source_version_id', v_source.id,
      'source_version_number', v_source.version_number
    ), actor
  );

  return jsonb_build_object(
    'proposal_id', target_proposal,
    'version_id', v_created.id,
    'version_number', v_next_number,
    'source_version_id', v_source.id
  );
end;
$$;

-- This definition keeps every accepted version immutable, while allowing a later
-- revision to become the selected accepted version. Pending purchases belonging to
-- the superseded selection are cancelled; approved purchases remain as evidence and
-- are reused when the stable service line still exists.
create or replace function public.accept_proposal_version(target_version uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_version public.proposal_versions%rowtype;
  v_proposal public.proposals%rowtype;
  v_now timestamptz := now();
  v_purchase_count integer := 0;
  v_auto_create_purchases boolean := true;
begin
  select * into v_version from public.proposal_versions where id = target_version for update;
  if not found then raise exception 'proposal_version_not_found'; end if;

  select * into v_proposal from public.proposals where id = v_version.proposal_id for update;
  if not found then raise exception 'proposal_not_found'; end if;
  if v_proposal.current_version_id is distinct from target_version then
    raise exception 'proposal_version_is_not_selected';
  end if;
  if v_version.locked and v_version.status = 'accepted' then
    return jsonb_build_object(
      'proposal_id', v_proposal.id,
      'version_id', target_version,
      'accepted_at', v_version.accepted_at,
      'already_accepted', true
    );
  end if;

  v_auto_create_purchases := public.routsify_setting_boolean(v_version.organization_id, 'purchases.auto_create', true);
  perform public.recalculate_proposal_version_economics(target_version);
  select * into v_version from public.proposal_versions where id = target_version for update;

  if coalesce(v_version.total_sale, 0) <= 0 then raise exception 'proposal_total_required'; end if;
  if not exists (
    select 1 from public.budget_lines
    where proposal_version_id = target_version and included = true
  ) then raise exception 'proposal_requires_included_lines'; end if;

  update public.proposal_versions
  set status = 'accepted',
      accepted_at = coalesce(accepted_at, v_now),
      locked_at = coalesce(locked_at, v_now),
      locked = true,
      margin_rules_snapshot_json = coalesce((
        select jsonb_object_agg(stable_line_id, coalesce(margin_snapshot, '{}'::jsonb))
        from public.budget_lines where proposal_version_id = target_version
      ), '{}'::jsonb),
      snapshot = coalesce(snapshot, '{}'::jsonb) || jsonb_build_object(
        'accepted_at', v_now,
        'formula_version_id', formula_version_id,
        'financial_summary', financial_summary_json,
        'line_count', (select count(*) from public.budget_lines where proposal_version_id = target_version and included = true),
        'purchases_auto_create', v_auto_create_purchases
      ),
      updated_at = v_now
  where id = target_version;

  update public.proposal_versions
  set status = 'expired', updated_at = v_now
  where proposal_id = v_proposal.id
    and id <> target_version
    and status in ('draft', 'sent', 'internal_review');

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
      next_action = 'Solicitar datos de viajeros',
      blocker = null,
      last_activity_at = v_now,
      updated_at = v_now,
      last_event_at = v_now
  where id = v_proposal.case_id;

  update public.expected_purchases ep
  set status = 'cancelled', active = false, cancelled_at = v_now,
      cancellation_reason = 'Sustituida por la versión aceptada ' || v_version.version_number || '.',
      updated_at = v_now
  where ep.case_id = v_proposal.case_id
    and ep.proposal_version_id <> target_version
    and ep.active = true
    and ep.status not in ('approved', 'not_required', 'cancelled')
    and exists (
      select 1 from public.proposal_versions previous_version
      where previous_version.id = ep.proposal_version_id
        and previous_version.proposal_id = v_proposal.id
    );

  update public.budget_lines target_line
  set expected_purchase_id = (
        select ep.id
        from public.expected_purchases ep
        join public.budget_lines previous_line on previous_line.id = ep.budget_line_id
        join public.proposal_versions previous_version on previous_version.id = ep.proposal_version_id
        where previous_version.proposal_id = v_proposal.id
          and previous_version.id <> target_version
          and previous_line.stable_line_id = target_line.stable_line_id
          and ep.status = 'approved'
        order by ep.updated_at desc
        limit 1
      ),
      updated_at = v_now
  where target_line.proposal_version_id = target_version
    and target_line.included = true
    and target_line.creates_expected_purchase = true
    and exists (
      select 1
      from public.expected_purchases ep
      join public.budget_lines previous_line on previous_line.id = ep.budget_line_id
      join public.proposal_versions previous_version on previous_version.id = ep.proposal_version_id
      where previous_version.proposal_id = v_proposal.id
        and previous_version.id <> target_version
        and previous_line.stable_line_id = target_line.stable_line_id
        and ep.status = 'approved'
    );

  if v_auto_create_purchases then
    insert into public.expected_purchases (
      organization_id, case_id, proposal_version_id, budget_line_id, supplier_id,
      supplier_name, provider_hash, service, expected_amount, amount, currency,
      status, required, active, review_notes
    )
    select
      line.organization_id, v_proposal.case_id, target_version, line.id,
      line.supplier_id, nullif(line.supplier_name, ''),
      encode(digest(lower(coalesce(nullif(line.supplier_name, ''), line.supplier_id::text, '')), 'sha256'), 'hex'),
      line.description_public, line.cost_budget, line.cost_budget, 'EUR',
      'expected'::public.expected_purchase_status,
      line.requirement_level = 'required', true,
      'Generada automáticamente al aceptar la versión ' || v_version.version_number || '.'
    from public.budget_lines line
    where line.proposal_version_id = target_version
      and line.included = true
      and line.creates_expected_purchase = true
      and line.expected_purchase_id is null
      and (line.supplier_id is not null or nullif(line.supplier_name, '') is not null or coalesce(line.cost_budget, 0) > 0)
    on conflict (proposal_version_id, budget_line_id) where budget_line_id is not null
    do update set
      supplier_id = excluded.supplier_id,
      supplier_name = excluded.supplier_name,
      provider_hash = excluded.provider_hash,
      service = excluded.service,
      expected_amount = excluded.expected_amount,
      amount = excluded.amount,
      required = excluded.required,
      active = true,
      status = case when public.expected_purchases.status = 'cancelled'
        then 'expected'::public.expected_purchase_status
        else public.expected_purchases.status end,
      updated_at = v_now;
    get diagnostics v_purchase_count = row_count;

    update public.budget_lines bl
    set expected_purchase_id = ep.id, updated_at = v_now
    from public.expected_purchases ep
    where bl.proposal_version_id = target_version
      and bl.expected_purchase_id is null
      and ep.proposal_version_id = target_version
      and ep.budget_line_id = bl.id;
  end if;

  insert into public.timeline_events (organization_id, case_id, event_type, title, payload)
  values (
    v_version.organization_id, v_proposal.case_id, 'proposal.accepted',
    'Presupuesto versión ' || v_version.version_number || ' aceptado',
    jsonb_build_object(
      'proposal_id', v_proposal.id,
      'version_id', target_version,
      'version_number', v_version.version_number,
      'purchases_auto_create', v_auto_create_purchases,
      'expected_purchases_upserted', v_purchase_count
    )
  );

  insert into public.audit_log (organization_id, entity_type, entity_id, action, after_data)
  values (
    v_version.organization_id, 'proposal_version', target_version, 'accepted',
    jsonb_build_object(
      'proposal_id', v_proposal.id,
      'case_id', v_proposal.case_id,
      'version_number', v_version.version_number,
      'purchases_auto_create', v_auto_create_purchases,
      'expected_purchases_upserted', v_purchase_count,
      'financial_summary', v_version.financial_summary_json
    )
  );

  return jsonb_build_object(
    'proposal_id', v_proposal.id,
    'version_id', target_version,
    'version_number', v_version.version_number,
    'accepted_at', v_now,
    'purchases_auto_create', v_auto_create_purchases,
    'expected_purchases_created', v_purchase_count
  );
end;
$$;

create or replace function public.create_contract_version_for_proposal(
  target_org uuid,
  target_case uuid,
  proposal_version_id_value uuid,
  contract_title text,
  legal_document_id_value uuid,
  notes_value text,
  contract_status_value text,
  actor uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.proposals%rowtype;
  v_version public.proposal_versions%rowtype;
begin
  select pv.* into v_version
  from public.proposal_versions pv
  join public.proposals p on p.id = pv.proposal_id
  where pv.id = proposal_version_id_value
    and pv.organization_id = target_org
    and p.organization_id = target_org
    and p.case_id = target_case
    and p.status = 'accepted'
    and pv.status = 'accepted'::public.proposal_version_status
    and pv.locked = true;
  if not found then raise exception 'accepted_locked_proposal_version_required'; end if;

  select * into v_proposal
  from public.proposals
  where id = v_version.proposal_id
  for update;

  update public.proposals
  set current_version_id = v_version.id, updated_at = now()
  where id = v_proposal.id;
  update public.cases
  set accepted_value = v_version.total_sale, updated_at = now()
  where id = target_case and organization_id = target_org;

  return public.create_contract_version_with_legal_document(
    target_org,
    target_case,
    contract_title,
    legal_document_id_value,
    notes_value,
    contract_status_value,
    actor
  );
end;
$$;

revoke all on function public.create_proposal_revision(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_proposal_revision(uuid, uuid, uuid, uuid) to service_role;
revoke all on function public.create_contract_version_for_proposal(uuid, uuid, uuid, text, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_contract_version_for_proposal(uuid, uuid, uuid, text, uuid, text, text, uuid) to service_role;
revoke all on function public.accept_proposal_version(uuid) from public, anon, authenticated;
grant execute on function public.accept_proposal_version(uuid) to service_role;
revoke all on function public.protect_accepted_proposal_status() from public, anon, authenticated;
grant execute on function public.protect_accepted_proposal_status() to service_role;
revoke all on function public.protect_locked_budget_lines() from public, anon, authenticated;
grant execute on function public.protect_locked_budget_lines() to service_role;
