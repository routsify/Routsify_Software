-- A contract may only be considered signed when its immutable version and
-- signature evidence can be joined. Legacy admin writes could skip both.
-- Preserve the original rows and business history, but stop presenting an
-- unverifiable signature as valid and route the case back through signing.

insert into public.audit_log (
  organization_id,
  entity_type,
  entity_id,
  action,
  before_data,
  after_data
)
select
  c.organization_id,
  'contract',
  c.id,
  'contract.unverifiable_signature_repaired',
  jsonb_build_object(
    'status', c.status,
    'current_version_id', c.current_version_id,
    'signed_at', c.signed_at,
    'had_signer_name', c.signed_by_name is not null,
    'had_signer_email', c.signed_by_email is not null
  ),
  jsonb_build_object(
    'status', 'draft',
    'reason', 'missing_contract_version_or_signature_evidence',
    'repair', '20260721103000_repair_unverifiable_contract_signatures'
  )
from public.contracts c
where c.status = 'signed'
  and (
    c.current_version_id is null
    or not exists (
      select 1
      from public.signature_evidence se
      where se.contract_id = c.id
        and se.contract_version_id = c.current_version_id
    )
  );

insert into public.timeline_events (
  organization_id,
  case_id,
  event_type,
  title,
  payload
)
select
  c.organization_id,
  c.case_id,
  'contract.signature_verification_required',
  'Firma contractual pendiente de verificación',
  jsonb_build_object(
    'contract_id', c.id,
    'previous_contract_version_id', c.current_version_id,
    'reason', 'missing_contract_version_or_signature_evidence'
  )
from public.contracts c
where c.status = 'signed'
  and (
    c.current_version_id is null
    or not exists (
      select 1
      from public.signature_evidence se
      where se.contract_id = c.id
        and se.contract_version_id = c.current_version_id
    )
  );

update public.cases target
set
  status = 'proposal_accepted'::public.case_status,
  next_action = 'Generar una versión del contrato y registrar una firma verificable',
  blocker = 'La firma anterior no tenía versión o evidencia verificable.',
  closure_check_at = null,
  close_blockers = jsonb_build_array(
    jsonb_build_object(
      'code', 'contract_signature_evidence_missing',
      'message', 'El contrato debe volver a firmarse con una versión y evidencia verificables.'
    )
  ),
  operational_closed_at = null,
  closed_at = null,
  updated_at = now()
where exists (
    select 1
    from public.contracts c
    where c.organization_id = target.organization_id
      and c.case_id = target.id
      and c.status = 'signed'
      and (
        c.current_version_id is null
        or not exists (
          select 1
          from public.signature_evidence se
          where se.contract_id = c.id
            and se.contract_version_id = c.current_version_id
        )
      )
  )
  and not exists (
    select 1
    from public.contracts valid_contract
    join public.signature_evidence valid_evidence
      on valid_evidence.contract_id = valid_contract.id
     and valid_evidence.contract_version_id = valid_contract.current_version_id
    where valid_contract.organization_id = target.organization_id
      and valid_contract.case_id = target.id
      and valid_contract.status = 'signed'
  );

update public.contract_versions version
set
  status = 'ready',
  locked_at = null
where version.status = 'signed'
  and exists (
    select 1
    from public.contracts c
    where c.current_version_id = version.id
      and c.status = 'signed'
      and not exists (
        select 1
        from public.signature_evidence se
        where se.contract_id = c.id
          and se.contract_version_id = version.id
      )
  );

update public.contracts c
set
  status = 'draft',
  signed_at = null,
  signed_by_name = null,
  signed_by_email = null,
  signature_ip_hash = null,
  signature_user_agent = null,
  signing_token_hash = null,
  signing_token_expires_at = null,
  updated_at = now()
where c.status = 'signed'
  and (
    c.current_version_id is null
    or not exists (
      select 1
      from public.signature_evidence se
      where se.contract_id = c.id
        and se.contract_version_id = c.current_version_id
    )
  );
