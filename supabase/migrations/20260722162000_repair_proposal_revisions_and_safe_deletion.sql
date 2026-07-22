-- Repair revisions created by the previous non-atomic flow and allow users to
-- remove test proposals until legal or economically irreversible work exists.

-- This is the trigger function used by older production installations. Keep the
-- acceptance lock, but permit the atomic revision RPC to reopen the proposal.
create or replace function public.prevent_unaccept_accepted_proposal()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'accepted'
     and new.status is distinct from 'accepted'
     and coalesce(current_setting('routsify.allow_proposal_revision', true), '') <> 'true'
  then
    raise exception 'accepted_proposal_locked';
  end if;
  return new;
end;
$$;

do $$
declare
  candidate record;
begin
  for candidate in
    select p.id as proposal_id, p.organization_id, p.case_id, editable.id as version_id,
           editable.version_number
    from public.proposals p
    join lateral (
      select pv.id, pv.version_number
      from public.proposal_versions pv
      where pv.proposal_id = p.id
        and pv.organization_id = p.organization_id
        and pv.locked = false
        and pv.status in ('draft', 'internal_review')
      order by pv.version_number desc
      limit 1
    ) editable on true
    where p.status = 'accepted'
      and p.current_version_id is distinct from editable.id
      and not exists (
        select 1 from public.contracts c
        where c.organization_id = p.organization_id
          and c.case_id = p.case_id
          and c.status = 'signed'
      )
  loop
    perform set_config('routsify.allow_proposal_revision', 'true', true);
    update public.proposals
    set current_version_id = candidate.version_id,
        status = 'draft',
        public_token_hash = null,
        public_token_expires_at = null,
        updated_at = now()
    where id = candidate.proposal_id
      and organization_id = candidate.organization_id;

    update public.cases
    set status = 'budget_draft',
        next_action = 'Revisar y enviar la versión ' || candidate.version_number || ' del presupuesto',
        updated_at = now()
    where id = candidate.case_id
      and organization_id = candidate.organization_id;
  end loop;
end $$;

create or replace function public.delete_unaccepted_proposal(
  target_org uuid,
  target_proposal uuid,
  actor uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  proposal_row public.proposals;
  protected_count integer := 0;
  version_ids uuid[] := array[]::uuid[];
  now_value timestamptz := now();
begin
  select * into proposal_row
  from public.proposals
  where id = target_proposal and organization_id = target_org
  for update;

  if proposal_row.id is null then raise exception 'proposal_not_found'; end if;

  select coalesce(array_agg(id), array[]::uuid[]) into version_ids
  from public.proposal_versions
  where proposal_id = target_proposal and organization_id = target_org;

  if cardinality(version_ids) > 0 then
    select
      (select count(*) from public.contract_versions
       where organization_id = target_org and proposal_version_id = any(version_ids))
      + (select count(*) from public.signature_evidence
         where organization_id = target_org and proposal_version_id = any(version_ids))
      + (select count(*) from public.contracts
         where organization_id = target_org
           and proposal_version_id = any(version_ids)
           and status <> 'draft')
      + (select count(*) from public.expected_purchases
         where organization_id = target_org
           and proposal_version_id = any(version_ids)
           and status not in ('expected', 'not_required', 'cancelled'))
    into protected_count;
  end if;

  -- Payments and issued fiscal documents are case-level records. A case has a
  -- single operational proposal in the product, so they also protect deletion.
  if protected_count = 0 then
    select
      (select count(*) from public.payments
       where organization_id = target_org and case_id = proposal_row.case_id)
      + (select count(*) from public.fiscal_documents
         where organization_id = target_org
           and case_id = proposal_row.case_id
           and status <> 'draft')
    into protected_count;
  end if;

  if protected_count > 0 then raise exception 'proposal_has_protected_history'; end if;

  delete from public.communication_followups
  where organization_id = target_org and proposal_id = target_proposal;

  delete from public.integration_outbox
  where organization_id = target_org
    and (
      entity_id = target_proposal
      or entity_id = any(version_ids)
      or payload->>'proposal_id' = target_proposal::text
      or payload->>'proposal_version_id' in (select unnest(version_ids)::text)
    );

  -- Acceptance creates an empty draft contract automatically. Remove only that
  -- untouched shell; manually prepared or versioned contracts stay protected.
  delete from public.contracts c
  where c.organization_id = target_org
    and c.case_id = proposal_row.case_id
    and c.status = 'draft'
    and c.current_version_id is null
    and not exists (select 1 from public.contract_versions cv where cv.contract_id = c.id)
    and (
      c.proposal_version_id = any(version_ids)
      or c.notes = 'Creado automáticamente tras registrar la aceptación manual del presupuesto.'
    );

  delete from public.proposals
  where id = target_proposal and organization_id = target_org;

  update public.cases
  set status = 'call_done',
      accepted_value = null,
      next_action = 'Preparar nuevo presupuesto',
      updated_at = now_value
  where id = proposal_row.case_id
    and organization_id = target_org;

  insert into public.audit_log(organization_id, actor_id, entity_type, entity_id, action, before_data, after_data)
  values (
    target_org,
    actor,
    'proposal',
    target_proposal,
    'proposal.deleted',
    to_jsonb(proposal_row),
    jsonb_build_object(
      'client_access_revoked', proposal_row.status in ('sent', 'accepted'),
      'accepted_history_removed', proposal_row.status = 'accepted',
      'deleted_at', now_value
    )
  );

  return jsonb_build_object(
    'id', target_proposal,
    'previous_status', proposal_row.status,
    'client_access_revoked', proposal_row.status in ('sent', 'accepted')
  );
end;
$$;

revoke all on function public.delete_unaccepted_proposal(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_unaccepted_proposal(uuid, uuid, uuid) to service_role;
