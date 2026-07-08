create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'viewer' check (role in ('admin','direction','sales','operations','billing','viewer')),
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  display_name text not null, client_type text not null default 'person', first_name text, last_name text, company_name text,
  email text, email_normalized text, phone text, phone_normalized text, tax_id text, billing_address jsonb not null default '{}'::jsonb,
  country text default 'ES', language text default 'es', source text default 'manual', holded_contact_id text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,email_normalized), unique (organization_id,phone_normalized)
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  source text not null, client_name text not null, email text, phone text, destination text, travel_dates text, travelers int default 1,
  budget_hint text, status text not null default 'new', priority text default 'normal', assigned_to text,
  converted_client_id uuid references public.clients(id), notes text, created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  external_id text, source text not null default 'booking_api', lead_id uuid references public.leads(id), payload jsonb not null default '{}'::jsonb,
  status text not null default 'received', created_at timestamptz not null default now(), unique (organization_id,source,external_id)
);

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  case_code text not null, client_id uuid references public.clients(id), title text not null, status text not null default 'new_lead', destination text,
  trip_start date, trip_end date, next_action text, blocker text, accepted_value numeric(12,2) not null default 0, currency text not null default 'EUR',
  final_notes text, closed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,case_code)
);

do $$ begin alter table public.leads add column if not exists converted_case_id uuid; exception when duplicate_column then null; end $$;
do $$ begin alter table public.leads add constraint leads_converted_case_fk foreign key (converted_case_id) references public.cases(id) deferrable initially deferred; exception when duplicate_object then null; end $$;

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade, public_token_hash text unique, public_token_expires_at timestamptz,
  status text not null default 'draft', created_at timestamptz not null default now()
);

create table if not exists public.proposal_versions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade, version_number int not null, status text not null default 'draft',
  total_sale numeric(12,2) not null default 0, total_cost numeric(12,2) not null default 0, locked boolean not null default false,
  snapshot jsonb not null default '{}'::jsonb, sent_at timestamptz, accepted_at timestamptz, expires_at timestamptz, created_at timestamptz not null default now(), unique (proposal_id,version_number)
);

create table if not exists public.budget_lines (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  proposal_version_id uuid not null references public.proposal_versions(id) on delete cascade, service_type_code text not null,
  description_public text not null, description_internal text, supplier_name text, destination_segment text, start_date date, end_date date,
  cost_budget numeric(12,2) not null default 0, margin_applied numeric(8,4) not null default 0, sale_price numeric(12,2) not null default 0,
  creates_expected_purchase boolean not null default false, created_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, category text, destination text, contact_name text, email text, phone text, status text not null default 'candidate', risk text not null default 'medium',
  payment_terms text, cancellation_terms text, preferred boolean not null default false, last_reviewed_at timestamptz, reviewed_by text, response_time_hours int, notes text,
  created_at timestamptz not null default now(), unique (organization_id,name,destination)
);

create table if not exists public.expected_purchases (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade, budget_line_id uuid references public.budget_lines(id), supplier_id uuid references public.suppliers(id),
  supplier_name text not null, service text not null, status text not null default 'expected', amount numeric(12,2) not null default 0, currency text not null default 'EUR',
  invoice_file text, invoice_number text, invoice_date date, invoice_base numeric(12,2), invoice_tax numeric(12,2), invoice_total numeric(12,2), not_required_reason text, review_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_invoices (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  expected_purchase_id uuid not null references public.expected_purchases(id) on delete cascade, storage_path text not null, invoice_number text, invoice_date date,
  total numeric(12,2), status text not null default 'reviewing', matched_document_id text, created_at timestamptz not null default now()
);

create table if not exists public.travelers (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade, full_name text not null, date_of_birth date, nationality text, document_type text,
  document_number text, document_expiry date, document_file text, status text not null default 'missing', notes text, created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade, type text not null, title text not null, storage_path text, status text not null default 'missing',
  owner text, visibility text default 'private', required boolean default false, uploaded_at timestamptz, expires_at date, reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id), rejection_reason text, notes text, created_at timestamptz not null default now()
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade, proposal_version_id uuid references public.proposal_versions(id), status text not null default 'draft',
  amount numeric(12,2) not null default 0, currency text not null default 'EUR', storage_path text, sent_at timestamptz, signed_at timestamptz,
  signer_name text, signature_reference text, blocker text, notes text, created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade, method text not null, amount numeric(12,2) not null default 0, currency text not null default 'EUR',
  status text not null default 'pending', received_at timestamptz, reference text, idempotency_key text, notes text, created_at timestamptz not null default now(), unique (organization_id,idempotency_key)
);

create table if not exists public.billing_documents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade, type text not null, amount numeric(12,2) not null default 0, currency text not null default 'EUR',
  status text not null default 'draft', external_document_id text, external_contact_ready boolean default false, payment_required boolean default true,
  locked boolean default false, sync_attempts int default 0, sync_message text, idempotency_key text, created_at timestamptz not null default now(), unique (organization_id,idempotency_key)
);

create table if not exists public.integration_outbox (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  channel text not null, event_type text not null, related_case_id uuid references public.cases(id), status text not null default 'pending',
  attempts int not null default 0, max_attempts int not null default 3, risk text default 'low', idempotency_key text, payload jsonb not null default '{}'::jsonb,
  last_error text, business_rule text, next_action text, created_at timestamptz not null default now(), last_attempt_at timestamptz, unique (organization_id,channel,event_type,idempotency_key)
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete cascade, actor_id uuid references public.profiles(id),
  entity_type text not null, entity_id uuid, action text not null, before_data jsonb, after_data jsonb, created_at timestamptz not null default now()
);
