-- Correcciones verificadas durante la auditoría operativa completa de producción.

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

-- pgcrypto está instalado en el esquema extensions.
alter function public.accept_proposal_version(uuid)
  set search_path = public, extensions;

create or replace function public.ensure_proposal_terms_snapshot()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if new.status in ('sent', 'accepted')
     and nullif(btrim(coalesce(new.terms_snapshot, '')), '') is null then
    new.terms_snapshot := 'La aceptación confirma la conformidad con los servicios, fechas e importes mostrados en esta versión. Routsify preparará el contrato, solicitará la documentación necesaria y coordinará los pagos y reservas correspondientes conforme a las condiciones contractuales aplicables.';
  end if;
  return new;
end;
$function$;

drop trigger if exists proposal_versions_freeze_terms on public.proposal_versions;
create trigger proposal_versions_freeze_terms
before insert or update of status on public.proposal_versions
for each row execute function public.ensure_proposal_terms_snapshot();

create or replace function public.sync_case_billing_status_from_document()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if new.case_id is null or new.status <> 'issued' then
    return new;
  end if;

  if coalesce(new.document_type, new.type) = 'final_invoice' then
    update public.cases
    set billing_status = 'final_invoice_issued',
        next_action = case when operational_closed_at is null then 'Cerrar expediente' else next_action end,
        blocker = null,
        updated_at = now()
    where id = new.case_id
      and organization_id = new.organization_id;
  elsif coalesce(new.document_type, new.type) = 'proforma' then
    update public.cases
    set billing_status = case
          when billing_status = 'final_invoice_issued' then billing_status
          else 'proforma_issued'
        end,
        updated_at = now()
    where id = new.case_id
      and organization_id = new.organization_id;
  end if;

  return new;
end;
$function$;

drop trigger if exists billing_documents_sync_case_status on public.billing_documents;
create trigger billing_documents_sync_case_status
after insert or update of status on public.billing_documents
for each row execute function public.sync_case_billing_status_from_document();

create or replace function public.enqueue_integration_event(
  target_org uuid,
  channel_name text,
  event_name text,
  idem_key text,
  event_payload jsonb,
  event_risk text default 'low'::text,
  rule text default null::text,
  action text default null::text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  result_id uuid;
  v_related_case_id uuid;
begin
  if target_org is null
     or nullif(channel_name,'') is null
     or nullif(event_name,'') is null
     or nullif(idem_key,'') is null then
    raise exception 'invalid_integration_event';
  end if;

  if coalesce(event_payload->>'case_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_related_case_id := (event_payload->>'case_id')::uuid;
  end if;

  insert into public.integration_outbox(
    organization_id,
    provider,
    channel,
    event_type,
    entity_type,
    related_case_id,
    idempotency_key,
    payload,
    sync_status,
    status,
    risk,
    business_rule,
    next_action,
    next_attempt_at
  ) values (
    target_org,
    channel_name,
    channel_name,
    event_name,
    'integration_event',
    v_related_case_id,
    idem_key,
    coalesce(event_payload,'{}'::jsonb),
    'pending'::public.sync_status,
    'pending',
    coalesce(event_risk,'low'),
    rule,
    action,
    now()
  )
  on conflict (organization_id,channel,event_type,idempotency_key)
  do update set
    payload = excluded.payload,
    related_case_id = coalesce(excluded.related_case_id, public.integration_outbox.related_case_id),
    risk = excluded.risk,
    business_rule = coalesce(excluded.business_rule,public.integration_outbox.business_rule),
    next_action = coalesce(excluded.next_action,public.integration_outbox.next_action),
    next_attempt_at = case
      when public.integration_outbox.status in ('done','manual_review') then public.integration_outbox.next_attempt_at
      else now()
    end
  returning id into result_id;

  return result_id;
end;
$function$;
