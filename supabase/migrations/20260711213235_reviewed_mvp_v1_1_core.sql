-- Routsify reviewed MVP v1.1 completion.
-- Additive, backwards-compatible contract for the deployed Next.js/Supabase application.

create extension if not exists pgcrypto;

alter table public.organizations add column if not exists close_margin_days integer not null default 5;
alter table public.organizations add column if not exists fiscal_mode_validated_at timestamptz;
alter table public.organizations add column if not exists fiscal_mode_validated_by uuid;
alter table public.organizations add column if not exists privacy_retention_days integer not null default 60;
alter table public.organizations add column if not exists supplier_invoice_retention_days integer not null default 365;

alter table public.clients add column if not exists billing_name text;
alter table public.clients add column if not exists billing_email text;
alter table public.clients add column if not exists tax_country text;
alter table public.clients add column if not exists fiscal_data_approved_at timestamptz;
alter table public.clients add column if not exists fiscal_data_approved_by uuid;
alter table public.clients add column if not exists responsible_user_id uuid references public.profiles(user_id) on delete set null;
alter table public.clients add column if not exists holded_sync_status text not null default 'pending';
alter table public.clients add column if not exists holded_sync_error text;
alter table public.clients add column if not exists holded_last_synced_at timestamptz;
alter table public.clients add column if not exists lifetime_value numeric(14,2) not null default 0;

alter table public.cases add column if not exists priority text not null default 'normal';
alter table public.cases add column if not exists last_activity_at timestamptz not null default now();
alter table public.cases add column if not exists billing_status text not null default 'pending';
alter table public.cases add column if not exists purchase_status text not null default 'pending';
alter table public.cases add column if not exists holded_project_id text;
alter table public.cases add column if not exists fiscal_resolution_status text not null default 'pending';
alter table public.cases add column if not exists fiscal_resolution_at timestamptz;
alter table public.cases add column if not exists fiscal_resolution_notes text;

alter type public.case_status add value if not exists 'documentation_approved' after 'proposal_accepted';

create table if not exists public.case_sequences (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  year integer not null,
  last_value integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (organization_id, year)
);

create or replace function public.next_case_code(target_org uuid, target_year integer default extract(year from current_date)::integer)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare v_number integer;
begin
  insert into public.case_sequences(organization_id, year, last_value)
  values(target_org, target_year, 1)
  on conflict (organization_id, year)
  do update set last_value=public.case_sequences.last_value+1, updated_at=now()
  returning last_value into v_number;
  return format('EXP-%s-%s', target_year, lpad(v_number::text, 4, '0'));
end;
$$;

alter table public.webhook_events add column if not exists idempotency_key text;
alter table public.webhook_events add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.webhook_events add column if not exists updated_at timestamptz not null default now();
update public.webhook_events set idempotency_key=coalesce(idempotency_key,channel||':'||event_id||':'||event_type) where idempotency_key is null;
create unique index if not exists webhook_events_org_channel_event_type_uidx on public.webhook_events(organization_id,channel,event_id,event_type);
create unique index if not exists webhook_events_org_idempotency_uidx on public.webhook_events(organization_id,idempotency_key) where idempotency_key is not null;

alter table public.document_access_log add column if not exists storage_path text;
alter table public.document_access_log add column if not exists expires_at timestamptz;
alter table public.document_access_log add column if not exists user_agent text;

alter table public.tasks add column if not exists blocker text;
alter table public.tasks add column if not exists idempotency_key text;
create unique index if not exists tasks_org_idempotency_uidx on public.tasks(organization_id,idempotency_key) where idempotency_key is not null;

alter table public.billing_documents add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.billing_documents add column if not exists type text;
alter table public.billing_documents add column if not exists trigger_name text;
alter table public.billing_documents add column if not exists tax_amount numeric(14,2) not null default 0;
alter table public.billing_documents add column if not exists issued_at timestamptz;
alter table public.billing_documents add column if not exists external_document_id text;
alter table public.billing_documents add column if not exists notes text;
alter table public.billing_documents add column if not exists idempotency_key text;
alter table public.billing_documents add column if not exists sync_message text;
alter table public.billing_documents add column if not exists last_synced_at timestamptz;
alter table public.billing_documents add column if not exists updated_at timestamptz not null default now();
update public.billing_documents set type=coalesce(type,document_type), trigger_name=coalesce(trigger_name,trigger), external_document_id=coalesce(external_document_id,holded_document_id), idempotency_key=coalesce(idempotency_key,'legacy:'||id::text) where type is null or trigger_name is null or idempotency_key is null;
create unique index if not exists billing_documents_org_idempotency_uidx on public.billing_documents(organization_id,idempotency_key) where idempotency_key is not null;

alter table public.contracts add column if not exists version integer not null default 1;
alter table public.contracts add column if not exists reviewed_by_client_at timestamptz;
alter table public.contracts add column if not exists signed_by_name text;
alter table public.contracts add column if not exists signed_by_email text;
alter table public.contracts add column if not exists signature_ip_hash text;
alter table public.contracts add column if not exists signature_user_agent text;

alter table public.payments add column if not exists updated_at timestamptz not null default now();

