create or replace function public.mark_fillout_leads_won_for_client(
  target_org uuid,
  target_client uuid,
  evidence_kind text,
  evidence_id uuid,
  evidence_at timestamptz,
  actor uuid default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_rows integer := 0;
  normalized_evidence text := coalesce(nullif(trim(evidence_kind), ''), 'commercial_evidence');
  effective_evidence_at timestamptz := coalesce(evidence_at, now());
begin
  if target_org is null or target_client is null then return 0; end if;

  insert into public.audit_log (
    organization_id, actor_id, action, entity_type, entity_id, before_data, after_data
  )
  select
    l.organization_id,
    actor,
    'fillout_outcome.auto_won',
    'lead',
    l.id,
    jsonb_build_object(
      'status', l.status,
      'review_status', l.review_status,
      'outcome', l.outcome,
      'archived_at', l.archived_at
    ),
    jsonb_build_object(
      'status', 'won',
      'review_status', 'reviewed',
      'outcome', 'won',
      'archived_at', null,
      'evidence_kind', normalized_evidence,
      'evidence_id', evidence_id,
      'evidence_at', effective_evidence_at
    )
  from public.leads l
  where l.organization_id = target_org
    and l.client_id = target_client
    and lower(coalesce(l.source, '')) like '%fillout%'
    and l.outcome <> 'won'
    and coalesce(l.form_received_at, l.created_at) <= effective_evidence_at + interval '1 day';

  update public.leads l
  set status = 'won',
      review_status = 'reviewed',
      outcome = 'won',
      reviewed_at = now(),
      reviewed_by = actor,
      review_note = case
        when normalized_evidence = 'accepted_proposal'
          then 'Compra confirmada automáticamente mediante presupuesto aceptado.'
        when normalized_evidence = 'confirmed_payment'
          then 'Compra confirmada automáticamente mediante cobro registrado.'
        else 'Compra confirmada automáticamente mediante evidencia comercial registrada.'
      end,
      archived_at = null,
      updated_at = now()
  where l.organization_id = target_org
    and l.client_id = target_client
    and lower(coalesce(l.source, '')) like '%fillout%'
    and l.outcome <> 'won'
    and coalesce(l.form_received_at, l.created_at) <= effective_evidence_at + interval '1 day';

  get diagnostics changed_rows = row_count;
  return changed_rows;
end;
$$;

revoke all on function public.mark_fillout_leads_won_for_client(uuid,uuid,text,uuid,timestamptz,uuid) from public, anon, authenticated;
grant execute on function public.mark_fillout_leads_won_for_client(uuid,uuid,text,uuid,timestamptz,uuid) to service_role;

create or replace function public.mark_fillout_won_from_proposal_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_client uuid;
begin
  if new.status::text = 'accepted' then
    if tg_op = 'UPDATE' and old.status::text = 'accepted' then return new; end if;
    select c.client_id into target_client
    from public.proposals p
    join public.cases c on c.id = p.case_id and c.organization_id = p.organization_id
    where p.id = new.proposal_id and p.organization_id = new.organization_id;

    perform public.mark_fillout_leads_won_for_client(
      new.organization_id,
      target_client,
      'accepted_proposal',
      new.id,
      coalesce(new.accepted_at, new.updated_at, new.created_at),
      null
    );
  end if;
  return new;
end;
$$;

revoke all on function public.mark_fillout_won_from_proposal_version() from public, anon, authenticated;

drop trigger if exists proposal_version_marks_fillout_won on public.proposal_versions;
create trigger proposal_version_marks_fillout_won
after insert or update of status on public.proposal_versions
for each row execute function public.mark_fillout_won_from_proposal_version();

create or replace function public.mark_fillout_won_from_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_client uuid;
begin
  if lower(coalesce(new.status::text, '')) in ('confirmed', 'paid', 'received') then
    if tg_op = 'UPDATE'
       and lower(coalesce(old.status::text, '')) in ('confirmed', 'paid', 'received') then return new; end if;
    select c.client_id into target_client
    from public.cases c
    where c.id = new.case_id and c.organization_id = new.organization_id;

    perform public.mark_fillout_leads_won_for_client(
      new.organization_id,
      target_client,
      'confirmed_payment',
      new.id,
      coalesce(new.confirmed_at, new.received_at, new.updated_at, new.created_at),
      new.confirmed_by
    );
  end if;
  return new;
end;
$$;

revoke all on function public.mark_fillout_won_from_payment() from public, anon, authenticated;

drop trigger if exists payment_marks_fillout_won on public.payments;
create trigger payment_marks_fillout_won
after insert or update of status on public.payments
for each row execute function public.mark_fillout_won_from_payment();

do $$
declare
  evidence record;
begin
  for evidence in
    select distinct on (organization_id, client_id)
      organization_id, client_id, evidence_kind, evidence_id, evidence_at, actor
    from (
      select
        pv.organization_id,
        c.client_id,
        'accepted_proposal'::text as evidence_kind,
        pv.id as evidence_id,
        coalesce(pv.accepted_at, pv.updated_at, pv.created_at) as evidence_at,
        null::uuid as actor
      from public.proposal_versions pv
      join public.proposals p on p.id = pv.proposal_id and p.organization_id = pv.organization_id
      join public.cases c on c.id = p.case_id and c.organization_id = p.organization_id
      where pv.status::text = 'accepted'

      union all

      select
        pay.organization_id,
        c.client_id,
        'confirmed_payment'::text,
        pay.id,
        coalesce(pay.confirmed_at, pay.received_at, pay.updated_at, pay.created_at),
        pay.confirmed_by
      from public.payments pay
      join public.cases c on c.id = pay.case_id and c.organization_id = pay.organization_id
      where lower(coalesce(pay.status::text, '')) in ('confirmed', 'paid', 'received')
    ) commercial_evidence
    order by organization_id, client_id, evidence_at desc
  loop
    perform public.mark_fillout_leads_won_for_client(
      evidence.organization_id,
      evidence.client_id,
      evidence.evidence_kind,
      evidence.evidence_id,
      evidence.evidence_at,
      evidence.actor
    );
  end loop;
end;
$$;
