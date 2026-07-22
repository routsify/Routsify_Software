insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('legal-documents', 'legal-documents', false, 15728640, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_type text not null check (document_type in ('travel_contract', 'general_terms', 'privacy_policy', 'precontractual_information', 'other')),
  title text not null,
  version_label text not null,
  file_name text not null,
  storage_bucket text not null default 'legal-documents' check (storage_bucket = 'legal-documents'),
  storage_path text not null,
  mime_type text not null default 'application/pdf' check (mime_type = 'application/pdf'),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 15728640),
  checksum text,
  status text not null default 'ready' check (status in ('ready', 'archived')),
  is_active boolean not null default false,
  is_test boolean not null default false,
  uploaded_by uuid,
  activated_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, storage_path)
);

comment on table public.legal_documents is 'Biblioteca privada y versionada de PDFs legales gestionada desde Ajustes.';

create unique index if not exists legal_documents_one_active_per_type_idx
  on public.legal_documents (organization_id, document_type)
  where is_active = true and status = 'ready' and is_test = false;

create index if not exists legal_documents_org_status_idx
  on public.legal_documents (organization_id, status, document_type, created_at desc);

alter table public.legal_documents enable row level security;
revoke all on table public.legal_documents from public, anon, authenticated;
grant all on table public.legal_documents to service_role;

alter table public.contracts
  add column if not exists legal_document_id uuid references public.legal_documents(id) on delete restrict;

alter table public.contract_versions
  add column if not exists legal_document_id uuid references public.legal_documents(id) on delete restrict;

create index if not exists contracts_legal_document_id_idx on public.contracts(legal_document_id);
create index if not exists contract_versions_legal_document_id_idx on public.contract_versions(legal_document_id);

create or replace function public.register_legal_document(
  target_org uuid,
  document_type_value text,
  title_value text,
  version_label_value text,
  file_name_value text,
  storage_path_value text,
  size_bytes_value bigint,
  checksum_value text,
  activate_value boolean,
  is_test_value boolean,
  actor uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_type text := lower(trim(coalesce(document_type_value, '')));
  normalized_title text := trim(coalesce(title_value, ''));
  normalized_version text := trim(coalesce(version_label_value, ''));
  normalized_file_name text := trim(coalesce(file_name_value, ''));
  normalized_path text := trim(coalesce(storage_path_value, ''));
  created_document public.legal_documents%rowtype;
begin
  if not exists (select 1 from public.organizations where id = target_org) then raise exception 'organization_not_found'; end if;
  if normalized_type not in ('travel_contract', 'general_terms', 'privacy_policy', 'precontractual_information', 'other') then raise exception 'invalid_legal_document_type'; end if;
  if length(normalized_title) < 3 then raise exception 'legal_document_title_required'; end if;
  if length(normalized_version) < 1 then raise exception 'legal_document_version_required'; end if;
  if lower(normalized_file_name) not like '%.pdf' then raise exception 'legal_document_pdf_required'; end if;
  if size_bytes_value <= 0 or size_bytes_value > 15728640 then raise exception 'invalid_legal_document_size'; end if;
  if normalized_path not like target_org::text || '/%' then raise exception 'invalid_legal_document_path'; end if;
  if coalesce(is_test_value, false) and normalized_title not like '[PRUEBA E2E]%' then raise exception 'invalid_test_legal_document'; end if;
  if coalesce(is_test_value, false) and coalesce(activate_value, false) then raise exception 'test_legal_document_cannot_be_active'; end if;

  if coalesce(activate_value, false) then
    update public.legal_documents
    set is_active = false, updated_at = now()
    where organization_id = target_org
      and document_type = normalized_type
      and is_active = true;
  end if;

  insert into public.legal_documents (
    organization_id, document_type, title, version_label, file_name,
    storage_bucket, storage_path, mime_type, size_bytes, checksum,
    status, is_active, is_test, uploaded_by, activated_at
  ) values (
    target_org, normalized_type, normalized_title, normalized_version, normalized_file_name,
    'legal-documents', normalized_path, 'application/pdf', size_bytes_value, nullif(trim(coalesce(checksum_value, '')), ''),
    'ready', coalesce(activate_value, false), coalesce(is_test_value, false), actor,
    case when coalesce(activate_value, false) then now() else null end
  ) returning * into created_document;

  insert into public.audit_log (organization_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    target_org, actor, 'legal_document', created_document.id, 'legal_document.uploaded',
    jsonb_build_object(
      'document_type', created_document.document_type,
      'title', created_document.title,
      'version_label', created_document.version_label,
      'file_name', created_document.file_name,
      'is_active', created_document.is_active,
      'is_test', created_document.is_test
    )
  );

  return to_jsonb(created_document);
end;
$$;

revoke all on function public.register_legal_document(uuid,text,text,text,text,text,bigint,text,boolean,boolean,uuid) from public, anon, authenticated;
grant execute on function public.register_legal_document(uuid,text,text,text,text,text,bigint,text,boolean,boolean,uuid) to service_role;

create or replace function public.set_legal_document_state(
  target_org uuid,
  target_document uuid,
  action_value text,
  actor uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_action text := lower(trim(coalesce(action_value, '')));
  current_document public.legal_documents%rowtype;
  updated_document public.legal_documents%rowtype;
begin
  select * into current_document
  from public.legal_documents
  where id = target_document and organization_id = target_org
  for update;
  if not found then raise exception 'legal_document_not_found'; end if;

  if requested_action = 'activate' then
    if current_document.is_test then raise exception 'test_legal_document_cannot_be_active'; end if;
    if current_document.status <> 'ready' then raise exception 'archived_legal_document_cannot_be_activated'; end if;
    update public.legal_documents
    set is_active = false, updated_at = now()
    where organization_id = target_org
      and document_type = current_document.document_type
      and id <> current_document.id
      and is_active = true;
    update public.legal_documents
    set is_active = true, activated_at = now(), updated_at = now()
    where id = current_document.id
    returning * into updated_document;
  elsif requested_action = 'archive' then
    update public.legal_documents
    set status = 'archived', is_active = false, archived_at = now(), updated_at = now()
    where id = current_document.id
    returning * into updated_document;
  else
    raise exception 'invalid_legal_document_action';
  end if;

  insert into public.audit_log (organization_id, actor_id, entity_type, entity_id, action, before_data, after_data)
  values (
    target_org, actor, 'legal_document', current_document.id, 'legal_document.' || requested_action,
    jsonb_build_object('status', current_document.status, 'is_active', current_document.is_active),
    jsonb_build_object('status', updated_document.status, 'is_active', updated_document.is_active)
  );

  return to_jsonb(updated_document);
end;
$$;

revoke all on function public.set_legal_document_state(uuid,uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.set_legal_document_state(uuid,uuid,text,uuid) to service_role;

create or replace function public.create_contract_version_with_legal_document(
  target_org uuid,
  target_case uuid,
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
  v_case public.cases%rowtype;
  v_client jsonb;
  v_proposal public.proposals%rowtype;
  v_version public.proposal_versions%rowtype;
  v_contract public.contracts%rowtype;
  v_contract_version public.contract_versions%rowtype;
  v_legal_document public.legal_documents%rowtype;
  v_legal_documents jsonb := '[]'::jsonb;
  v_travelers jsonb;
  adult_count integer := 0;
  pending_travelers integer := 0;
  next_version integer := 1;
  normalized_status text := coalesce(nullif(contract_status_value, ''), 'draft');
begin
  if normalized_status not in ('draft', 'sent') then raise exception 'invalid_contract_status'; end if;

  select * into v_case
  from public.cases
  where id = target_case and organization_id = target_org
  for update;
  if not found then raise exception 'case_not_found'; end if;
  if v_case.trip_start is null or v_case.trip_end is null then raise exception 'trip_dates_required'; end if;
  if coalesce(v_case.accepted_value, 0) <= 0 then raise exception 'accepted_total_required'; end if;

  select * into v_legal_document
  from public.legal_documents
  where id = legal_document_id_value and organization_id = target_org;
  if not found then raise exception 'legal_pdf_required_before_send'; end if;
  if v_legal_document.document_type <> 'travel_contract' then raise exception 'travel_contract_pdf_required'; end if;
  if v_legal_document.status <> 'ready' then raise exception 'archived_legal_document_not_selectable'; end if;
  if v_legal_document.is_test and v_case.title not like '[PRUEBA E2E %' then raise exception 'test_legal_document_forbidden'; end if;

  select p.* into v_proposal
  from public.proposals p
  join public.proposal_versions pv on pv.id = p.current_version_id
  where p.organization_id = target_org
    and p.case_id = target_case
    and p.status = 'accepted'
    and pv.status = 'accepted'::public.proposal_version_status
    and pv.locked = true
  order by p.updated_at desc
  limit 1;
  if not found then raise exception 'accepted_locked_proposal_required'; end if;
  select * into v_version from public.proposal_versions where id = v_proposal.current_version_id;
  if nullif(trim(coalesce(v_version.terms_snapshot, '')), '') is null then raise exception 'accepted_terms_required'; end if;

  select count(*) filter (where traveler_type = 'adult'),
         count(*) filter (where review_status <> 'approved'::public.traveler_review_status)
  into adult_count, pending_travelers
  from public.travelers
  where organization_id = target_org and case_id = target_case;
  if adult_count = 0 then raise exception 'approved_adult_traveler_required'; end if;
  if pending_travelers > 0 then raise exception 'all_travelers_must_be_approved'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'traveler_type', traveler_type,
    'first_name', first_name,
    'last_name', last_name,
    'birth_date', birth_date,
    'nationality', nationality,
    'document_type', document_type,
    'document_number', document_number,
    'issuing_country', coalesce(issuing_country, document_country),
    'document_expires_at', document_expires_at,
    'review_status', review_status
  ) order by created_at), '[]'::jsonb)
  into v_travelers
  from public.travelers
  where organization_id = target_org and case_id = target_case;

  select to_jsonb(c) into v_client
  from public.clients c
  where c.id = v_case.client_id and c.organization_id = target_org;

  if v_legal_document.is_test then
    v_legal_documents := jsonb_build_array(jsonb_build_object(
      'id', v_legal_document.id,
      'document_type', v_legal_document.document_type,
      'title', v_legal_document.title,
      'version_label', v_legal_document.version_label,
      'file_name', v_legal_document.file_name,
      'checksum', v_legal_document.checksum
    ));
  else
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', d.id,
      'document_type', d.document_type,
      'title', d.title,
      'version_label', d.version_label,
      'file_name', d.file_name,
      'checksum', d.checksum
    ) order by case when d.id = v_legal_document.id then 0 else 1 end, d.document_type), '[]'::jsonb)
    into v_legal_documents
    from public.legal_documents d
    where d.organization_id = target_org
      and d.status = 'ready'
      and d.is_test = false
      and (
        d.id = v_legal_document.id
        or (d.is_active = true and d.document_type <> 'travel_contract')
      );
  end if;

  select * into v_contract
  from public.contracts
  where organization_id = target_org and case_id = target_case
  for update;
  if found and v_contract.status = 'signed' then raise exception 'signed_contract_is_immutable'; end if;

  if not found then
    insert into public.contracts (
      organization_id, case_id, title, status, external_url, legal_document_id,
      notes, proposal_version_id, legal_version, reviewed_at, reviewed_by
    ) values (
      target_org, target_case, coalesce(nullif(trim(contract_title), ''), 'Contrato de viaje'),
      normalized_status, null, v_legal_document.id, nullif(trim(notes_value), ''),
      v_version.id, v_legal_document.version_label, now(), actor
    ) returning * into v_contract;
  else
    update public.contracts
    set title = coalesce(nullif(trim(contract_title), ''), title),
        status = normalized_status,
        external_url = null,
        legal_document_id = v_legal_document.id,
        notes = nullif(trim(notes_value), ''),
        proposal_version_id = v_version.id,
        legal_version = v_legal_document.version_label,
        reviewed_at = now(),
        reviewed_by = actor,
        updated_at = now()
    where id = v_contract.id
    returning * into v_contract;
  end if;

  select coalesce(max(version_number), 0) + 1 into next_version
  from public.contract_versions
  where contract_id = v_contract.id;

  insert into public.contract_versions (
    organization_id, contract_id, case_id, proposal_version_id, version_number,
    legal_version, legal_document_id, content_snapshot, status, created_by
  ) values (
    target_org, v_contract.id, target_case, v_version.id, next_version,
    v_legal_document.version_label, v_legal_document.id,
    jsonb_build_object(
      'case', jsonb_build_object(
        'id', v_case.id,
        'case_code', v_case.case_code,
        'title', v_case.title,
        'destination', v_case.destination,
        'trip_start', v_case.trip_start,
        'trip_end', v_case.trip_end,
        'currency', v_case.currency
      ),
      'client', coalesce(v_client, '{}'::jsonb),
      'travelers', v_travelers,
      'proposal', jsonb_build_object(
        'id', v_proposal.id,
        'version_id', v_version.id,
        'version_number', v_version.version_number,
        'title', v_version.title,
        'narrative', v_version.narrative,
        'terms', v_version.terms_snapshot,
        'total_sale', v_version.total_sale,
        'currency', v_case.currency
      ),
      'legal_version', v_legal_document.version_label,
      'legal_documents', v_legal_documents,
      'generated_at', now()
    ),
    normalized_status,
    actor
  ) returning * into v_contract_version;

  update public.contracts
  set current_version_id = v_contract_version.id,
      version = next_version,
      updated_at = now()
  where id = v_contract.id
  returning * into v_contract;

  update public.cases
  set status = 'contract_ready'::public.case_status,
      next_action = case when normalized_status = 'sent' then 'Esperar firma del contrato' else 'Enviar contrato al cliente' end,
      blocker = null,
      last_activity_at = now(),
      updated_at = now()
  where id = target_case;

  insert into public.timeline_events (organization_id, case_id, event_type, title, payload, created_by)
  values (
    target_org, target_case, 'contract.version_created',
    case when normalized_status = 'sent' then 'Contrato generado y enviado' else 'Nueva versión de contrato generada' end,
    jsonb_build_object(
      'contract_id', v_contract.id,
      'contract_version_id', v_contract_version.id,
      'version', next_version,
      'legal_version', v_legal_document.version_label,
      'legal_document_id', v_legal_document.id,
      'status', normalized_status
    ),
    actor
  );

  insert into public.audit_log (organization_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    target_org, actor, 'contract', v_contract.id, 'contract.version_created',
    jsonb_build_object(
      'contract_version_id', v_contract_version.id,
      'version_number', next_version,
      'proposal_version_id', v_version.id,
      'legal_version', v_legal_document.version_label,
      'legal_document_id', v_legal_document.id,
      'status', normalized_status
    )
  );

  return jsonb_build_object(
    'contract', to_jsonb(v_contract),
    'version', to_jsonb(v_contract_version),
    'legal_document', to_jsonb(v_legal_document)
  );
end;
$$;

revoke all on function public.create_contract_version_with_legal_document(uuid,uuid,text,uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.create_contract_version_with_legal_document(uuid,uuid,text,uuid,text,text,uuid) to service_role;
