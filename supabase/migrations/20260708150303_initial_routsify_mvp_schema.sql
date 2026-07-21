create extension if not exists pgcrypto;

create type public.app_role as enum ('admin','direction','sales','operations','billing','viewer');
create type public.case_status as enum ('new_lead','call_booked','call_done','budget_draft','proposal_sent','proposal_accepted','contract_ready','contract_signed','payment_confirmed','suppliers_pending','ready_to_close','closed');
create type public.proposal_version_status as enum ('draft','sent','accepted','internal_review','lost','expired');
create type public.expected_purchase_status as enum ('expected','requested','uploaded','holded_candidate','matched','review_needed','approved','not_required','cancelled');
create type public.sync_status as enum ('pending','processing','synced','sync_error','cancelled');
create type public.traveler_review_status as enum ('pending','reviewed','approved','rejected');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  fiscal_mode text not null default 'manual_review',
  brand_primary_color text not null default '#379237',
  brand_background_color text not null default '#ffffff',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text,
  role public.app_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where user_id = auth.uid() limit 1
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid() limit 1
$$;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_type text not null default 'person',
  display_name text not null,
  first_name text,
  last_name text,
  company_name text,
  email text,
  email_normalized text,
  phone text,
  phone_normalized text,
  tax_id text,
  billing_address jsonb not null default '{}'::jsonb,
  country text,
  language text default 'es',
  source text,
  holded_contact_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email_normalized)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  source text not null default 'manual',
  source_submission_id text,
  payload_hash text,
  payload_redacted jsonb not null default '{}'::jsonb,
  status text not null default 'new',
  campaign text,
  destination text,
  travel_start date,
  travel_end date,
  budget_hint numeric(12,2),
  created_at timestamptz not null default now(),
  unique (organization_id, source, source_submission_id)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  external_booking_id text not null,
  event_type text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'created',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, external_booking_id, event_type)
);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete set null,
  case_code text not null,
  title text not null,
  status public.case_status not null default 'new_lead',
  responsible_user_id uuid references public.profiles(user_id) on delete set null,
  destination text,
  trip_start date,
  trip_end date,
  next_action text,
  next_action_at timestamptz,
  blocker text,
  accepted_value numeric(12,2),
  currency text not null default 'EUR',
  last_event_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, case_code)
);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  title text not null,
  public_token_hash text,
  public_token_expires_at timestamptz,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.proposal_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  version_number integer not null,
  status public.proposal_version_status not null default 'draft',
  title text not null,
  narrative jsonb not null default '{}'::jsonb,
  terms_snapshot text,
  margin_snapshot jsonb not null default '{}'::jsonb,
  total_sale numeric(12,2) not null default 0,
  total_cost_budget numeric(12,2) not null default 0,
  budgeted_profit numeric(12,2) not null default 0,
  accepted_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (proposal_id, version_number)
);

alter table public.proposals add constraint proposals_current_version_fk foreign key (current_version_id) references public.proposal_versions(id) on delete set null;

create table public.service_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  tax_id text,
  email text,
  phone text,
  country text,
  holded_contact_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  proposal_version_id uuid not null references public.proposal_versions(id) on delete cascade,
  stable_line_id text not null,
  service_type_id uuid references public.service_types(id) on delete set null,
  service_type_code text,
  description_internal text,
  description_public text not null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  destination_segment text,
  start_date date,
  end_date date,
  cost_budget numeric(12,2) not null default 0,
  cost_real numeric(12,2),
  margin_applied numeric(8,6) not null default 0.25,
  sale_price numeric(12,2) not null default 0,
  creates_expected_purchase boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  unique (proposal_version_id, stable_line_id)
);

create table public.expected_purchases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  proposal_version_id uuid not null references public.proposal_versions(id) on delete cascade,
  budget_line_id uuid not null references public.budget_lines(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  status public.expected_purchase_status not null default 'expected',
  expected_amount numeric(12,2),
  currency text not null default 'EUR',
  due_date date,
  not_required_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, budget_line_id, supplier_id)
);

create table public.supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  expected_purchase_id uuid references public.expected_purchases(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  holded_purchase_id text,
  invoice_number text,
  invoice_date date,
  base_amount numeric(12,2),
  tax_amount numeric(12,2),
  total_amount numeric(12,2),
  currency text not null default 'EUR',
  storage_path text,
  sync_status public.sync_status not null default 'pending',
  reviewed_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.billing_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  document_type text not null,
  trigger text not null,
  holded_document_id text,
  document_number text,
  amount numeric(12,2),
  currency text not null default 'EUR',
  status text not null default 'manual_review',
  sync_status public.sync_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (case_id, document_type, trigger)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  payment_reference text not null,
  provider text not null default 'manual',
  method text not null default 'transfer',
  amount numeric(12,2) not null,
  currency text not null default 'EUR',
  status text not null default 'confirmed',
  confirmed_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, payment_reference)
);

create table public.travelers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  traveler_type text not null default 'adult',
  first_name text not null,
  last_name text not null,
  birth_date date,
  nationality text,
  document_country text,
  document_number text,
  document_expires_at date,
  review_status public.traveler_review_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_type text not null,
  owner_id uuid not null,
  document_type text not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  retention_until date,
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.integration_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  sync_status public.sync_status not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, idempotency_key)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(user_id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public) values
  ('invoices', 'invoices', false),
  ('travel-documents', 'travel-documents', false),
  ('proposal-assets', 'proposal-assets', false)
on conflict (id) do nothing;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.leads enable row level security;
alter table public.bookings enable row level security;
alter table public.cases enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_versions enable row level security;
alter table public.service_types enable row level security;
alter table public.suppliers enable row level security;
alter table public.budget_lines enable row level security;
alter table public.expected_purchases enable row level security;
alter table public.supplier_invoices enable row level security;
alter table public.billing_documents enable row level security;
alter table public.payments enable row level security;
alter table public.travelers enable row level security;
alter table public.documents enable row level security;
alter table public.integration_outbox enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_read_own_org on public.profiles for select to authenticated using (organization_id = public.current_org_id() or user_id = auth.uid());
create policy profiles_admin_write on public.profiles for all to authenticated using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

create policy organizations_read_own on public.organizations for select to authenticated using (id = public.current_org_id());
create policy organizations_admin_update on public.organizations for update to authenticated using (id = public.current_org_id() and public.current_app_role() = 'admin') with check (id = public.current_org_id());

create policy clients_org_access on public.clients for all to authenticated using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy leads_org_access on public.leads for all to authenticated using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy bookings_org_access on public.bookings for all to authenticated using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy cases_org_access on public.cases for all to authenticated using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy proposals_org_access on public.proposals for all to authenticated using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy proposal_versions_org_access on public.proposal_versions for all to authenticated using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy service_types_org_access on public.service_types for all to authenticated using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy suppliers_org_access on public.suppliers for all to authenticated using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy budget_lines_org_access on public.budget_lines for all to authenticated using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy expected_purchases_org_access on public.expected_purchases for all to authenticated using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy supplier_invoices_org_access on public.supplier_invoices for all to authenticated using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy billing_documents_org_access on public.billing_documents for all to authenticated using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy payments_org_access on public.payments for all to authenticated using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy travelers_org_access on public.travelers for all to authenticated using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy documents_org_access on public.documents for all to authenticated using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy integration_outbox_org_access on public.integration_outbox for all to authenticated using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create policy audit_log_org_read on public.audit_log for select to authenticated using (organization_id = public.current_org_id());
create policy audit_log_org_insert on public.audit_log for insert to authenticated with check (organization_id = public.current_org_id());

create index idx_clients_org_name on public.clients (organization_id, display_name);
create index idx_cases_org_status on public.cases (organization_id, status);
create index idx_cases_next_action on public.cases (organization_id, next_action_at);
create index idx_budget_lines_version on public.budget_lines (proposal_version_id, sort_order);
create index idx_expected_purchases_status on public.expected_purchases (organization_id, status);
create index idx_outbox_status on public.integration_outbox (sync_status, created_at);

