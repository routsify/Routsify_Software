alter table public.contracts add column if not exists current_version_id uuid;
alter table public.contracts add column if not exists proposal_version_id uuid references public.proposal_versions(id) on delete restrict;
alter table public.contracts add column if not exists legal_version text;
alter table public.contracts add column if not exists reviewed_at timestamptz;
alter table public.contracts add column if not exists reviewed_by uuid;
alter table public.contracts add column if not exists signing_token_hash text;
alter table public.contracts add column if not exists signing_token_expires_at timestamptz;

create table if not exists public.contract_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  proposal_version_id uuid not null references public.proposal_versions(id) on delete restrict,
  version_number integer not null,
  legal_version text not null,
  content_snapshot jsonb not null default '{}'::jsonb,
  document_id uuid references public.documents(id) on delete set null,
  status text not null default 'draft',
  locked_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique(contract_id, version_number)
);

do $$ begin
  alter table public.contracts add constraint contracts_current_version_fk foreign key (current_version_id) references public.contract_versions(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.signature_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  contract_version_id uuid not null references public.contract_versions(id) on delete restrict,
  proposal_version_id uuid not null references public.proposal_versions(id) on delete restrict,
  signer_name text not null,
  signer_email text,
  ip_hash text,
  user_agent text,
  evidence jsonb not null default '{}'::jsonb,
  signed_at timestamptz not null default now(),
  unique(contract_version_id)
);

create table if not exists public.payment_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  contract_version_id uuid references public.contract_versions(id) on delete restrict,
  provider text not null default 'external',
  external_url text not null,
  token_hash text not null,
  amount numeric(14,2) not null,
  currency text not null default 'EUR',
  status text not null default 'created',
  sent_at timestamptz,
  clicked_at timestamptz,
  confirmed_at timestamptz,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, token_hash)
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payment_link_id uuid references public.payment_links(id) on delete set null,
  case_id uuid not null references public.cases(id) on delete cascade,
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload_redacted jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(organization_id, provider, event_id, event_type)
);

alter table public.payments add column if not exists payment_link_id uuid references public.payment_links(id) on delete set null;
alter table public.payments add column if not exists source text not null default 'manual';
alter table public.payments add column if not exists confirmed_by uuid;

create or replace function public.sign_contract_version(
  target_org uuid,
  target_contract_version uuid,
  signer_name_value text,
  signer_email_value text,
  ip_hash_value text,
  user_agent_value text,
  evidence_value jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_version public.contract_versions%rowtype;
  v_contract public.contracts%rowtype;
  v_evidence public.signature_evidence%rowtype;
  v_now timestamptz:=now();
begin
  select * into v_version from public.contract_versions where id=target_contract_version and organization_id=target_org for update;
  if not found then raise exception 'contract_version_not_found'; end if;
  select * into v_contract from public.contracts where id=v_version.contract_id and organization_id=target_org for update;
  if not found then raise exception 'contract_not_found'; end if;
  if v_version.status='signed' then
    select * into v_evidence from public.signature_evidence where contract_version_id=v_version.id;
    return jsonb_build_object('already_signed',true,'evidence',to_jsonb(v_evidence));
  end if;
  if v_version.status not in ('ready','sent','reviewed') then raise exception 'contract_not_ready_for_signature'; end if;
  if length(trim(coalesce(signer_name_value,'')))<2 then raise exception 'signer_name_required'; end if;

  insert into public.signature_evidence(organization_id,case_id,contract_id,contract_version_id,proposal_version_id,signer_name,signer_email,ip_hash,user_agent,evidence,signed_at)
  values(target_org,v_version.case_id,v_contract.id,v_version.id,v_version.proposal_version_id,trim(signer_name_value),nullif(lower(trim(signer_email_value)),''),nullif(ip_hash_value,''),left(user_agent_value,500),coalesce(evidence_value,'{}'::jsonb),v_now)
  on conflict (contract_version_id) do update set evidence=excluded.evidence
  returning * into v_evidence;

  update public.contract_versions set status='signed',locked_at=v_now where id=v_version.id;
  update public.contracts set status='signed',signed_at=v_now,current_version_id=v_version.id,updated_at=v_now,signing_token_hash=null,signing_token_expires_at=null where id=v_contract.id;
  update public.cases set status='contract_signed'::public.case_status,next_action='Enviar o confirmar pago',blocker=null,last_activity_at=v_now,last_event_at=v_now,updated_at=v_now where id=v_version.case_id;
  insert into public.timeline_events(organization_id,case_id,event_type,title,payload)
  values(target_org,v_version.case_id,'contract.signed','Contrato firmado',jsonb_build_object('contract_id',v_contract.id,'contract_version_id',v_version.id,'signature_evidence_id',v_evidence.id));
  return jsonb_build_object('contract',to_jsonb(v_contract),'version',to_jsonb(v_version),'evidence',to_jsonb(v_evidence));
end;
$$;

