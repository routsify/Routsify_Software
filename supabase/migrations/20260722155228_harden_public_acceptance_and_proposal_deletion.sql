-- Make public proposal acceptance atomic and preserve accepted evidence.

create or replace function public.accept_public_proposal_version(
  target_version uuid,
  acceptor_name_value text,
  acceptor_email_value text,
  ip_hash_value text,
  user_agent_value text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_version public.proposal_versions%rowtype;
  v_proposal public.proposals%rowtype;
  v_acceptance public.proposal_acceptances%rowtype;
  v_accept_result jsonb;
  v_now timestamptz := now();
begin
  select * into v_version
  from public.proposal_versions
  where id = target_version
  for update;

  if not found then raise exception 'proposal_version_not_found'; end if;

  select * into v_proposal
  from public.proposals
  where id = v_version.proposal_id
  for update;

  if not found then raise exception 'proposal_not_found'; end if;
  if v_proposal.current_version_id is distinct from target_version then
    raise exception 'proposal_version_is_not_selected';
  end if;

  if length(trim(coalesce(acceptor_name_value, ''))) < 2 then
    raise exception 'acceptor_name_required';
  end if;

  select * into v_acceptance
  from public.proposal_acceptances
  where proposal_version_id = target_version
  for update;

  if found then
    return jsonb_build_object(
      'proposal_id', v_proposal.id,
      'version_id', target_version,
      'already_accepted', true,
      'acceptance', jsonb_build_object(
        'id', v_acceptance.id,
        'accepted_at', v_acceptance.accepted_at,
        'acceptor_name', v_acceptance.acceptor_name
      )
    );
  end if;

  v_accept_result := public.accept_proposal_version(target_version);

  insert into public.proposal_acceptances (
    organization_id,
    proposal_id,
    proposal_version_id,
    case_id,
    acceptor_name,
    acceptor_email,
    terms_accepted,
    ip_hash,
    user_agent,
    accepted_at
  )
  values (
    v_version.organization_id,
    v_proposal.id,
    target_version,
    v_proposal.case_id,
    trim(acceptor_name_value),
    nullif(trim(coalesce(acceptor_email_value, '')), ''),
    true,
    nullif(trim(coalesce(ip_hash_value, '')), ''),
    left(nullif(trim(coalesce(user_agent_value, '')), ''), 500),
    v_now
  )
  returning * into v_acceptance;

  insert into public.contracts (organization_id, case_id, title, status, notes)
  select v_version.organization_id, v_proposal.case_id, 'Contrato de viaje', 'draft',
         'Creado automaticamente tras la aceptacion publica del presupuesto.'
  where not exists (
    select 1 from public.contracts c
    where c.organization_id = v_version.organization_id
      and c.case_id = v_proposal.case_id
  );

  insert into public.tasks (
    organization_id,
    case_id,
    title,
    status,
    priority,
    due_at,
    idempotency_key,
    payload
  )
  values (
    v_version.organization_id,
    v_proposal.case_id,
    'Preparar contrato y solicitar documentacion',
    'pending',
    'high',
    v_now + interval '1 day',
    'public_acceptance_followup:' || v_proposal.id::text || ':' || target_version::text,
    jsonb_build_object('source', 'proposal_acceptance', 'proposal_id', v_proposal.id, 'version_id', target_version)
  )
  on conflict (organization_id, idempotency_key) do update
  set status = case when public.tasks.status in ('done', 'cancelled') then public.tasks.status else excluded.status end,
      priority = excluded.priority,
      due_at = excluded.due_at,
      payload = excluded.payload,
      updated_at = v_now;

  insert into public.timeline_events (organization_id, case_id, event_type, title, payload)
  values (
    v_version.organization_id,
    v_proposal.case_id,
    'proposal.accepted_publicly',
    'Presupuesto aceptado por ' || trim(acceptor_name_value),
    jsonb_build_object(
      'proposal_id', v_proposal.id,
      'version_id', target_version,
      'acceptance_id', v_acceptance.id,
      'accepted_at', v_acceptance.accepted_at
    )
  );

  return v_accept_result || jsonb_build_object(
    'proposal_id', v_proposal.id,
    'version_id', target_version,
    'already_accepted', false,
    'acceptance', jsonb_build_object(
      'id', v_acceptance.id,
      'accepted_at', v_acceptance.accepted_at,
      'acceptor_name', v_acceptance.acceptor_name
    )
  );
end;
$$;

revoke all on function public.accept_public_proposal_version(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.accept_public_proposal_version(uuid, text, text, text, text) to service_role;

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

  if proposal_row.status = 'accepted'
     or exists (
       select 1 from public.proposal_versions pv
       where pv.organization_id = target_org
         and pv.proposal_id = target_proposal
         and (pv.status = 'accepted'::public.proposal_version_status or pv.accepted_at is not null)
     )
     or exists (
       select 1 from public.proposal_acceptances pa
       where pa.organization_id = target_org
         and pa.proposal_id = target_proposal
     )
  then
    raise exception 'proposal_has_accepted_history';
  end if;

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

  delete from public.contracts c
  where c.organization_id = target_org
    and c.case_id = proposal_row.case_id
    and c.status = 'draft'
    and c.current_version_id is null
    and not exists (select 1 from public.contract_versions cv where cv.contract_id = c.id)
    and c.proposal_version_id = any(version_ids);

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
      'client_access_revoked', proposal_row.status = 'sent',
      'deleted_at', now_value
    )
  );

  return jsonb_build_object(
    'id', target_proposal,
    'previous_status', proposal_row.status,
    'client_access_revoked', proposal_row.status = 'sent'
  );
end;
$$;

revoke all on function public.delete_unaccepted_proposal(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_unaccepted_proposal(uuid, uuid, uuid) to service_role;
