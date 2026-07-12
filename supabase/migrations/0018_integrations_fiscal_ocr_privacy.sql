-- Routsify MVP v1.1 schema alignment: Teya links, OCR and five-year retention.
create extension if not exists pgcrypto;

create table if not exists public.payment_links(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  proposal_version_id uuid references public.proposal_versions(id) on delete set null,
  provider text not null default 'teya_manual',
  external_url text not null,
  token_hash text,
  amount numeric(14,2) not null,
  currency text not null default 'EUR',
  status text not null default 'created',
  created_by uuid,
  confirmed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_links_case_idx on public.payment_links(organization_id,case_id,created_at desc);
alter table public.payment_links enable row level security;

alter table public.payments add column if not exists payment_link_id uuid references public.payment_links(id) on delete set null;
alter table public.payments add column if not exists source text not null default 'manual';
alter table public.payments add column if not exists confirmed_by uuid;
alter table public.billing_documents add column if not exists holded_document_id text;
alter table public.organizations add column if not exists close_margin_days integer not null default 5;
alter table public.organizations add column if not exists privacy_retention_days integer not null default 1825;
alter table public.organizations add column if not exists supplier_invoice_retention_days integer not null default 1825;
alter table public.documents add column if not exists temporary boolean not null default false;
alter table public.documents add column if not exists purge_after timestamptz;
alter table public.documents add column if not exists purged_at timestamptz;
alter table public.documents add column if not exists scan_status text not null default 'pending';
alter table public.documents add column if not exists ocr_status text not null default 'not_started';
alter table public.travelers add column if not exists document_type text;
alter table public.travelers add column if not exists issuing_country text;
alter table public.travelers add column if not exists mrz text;
alter table public.travelers add column if not exists ocr_status text not null default 'not_started';
alter table public.travelers add column if not exists ocr_confidence numeric(5,4);
alter table public.travelers add column if not exists reviewed_by uuid;
alter table public.travelers add column if not exists reviewed_at timestamptz;
