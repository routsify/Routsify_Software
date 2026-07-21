create table if not exists public.proposal_acceptances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  proposal_version_id uuid not null references public.proposal_versions(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  acceptor_name text not null,
  acceptor_email text,
  terms_accepted boolean not null default false,
  ip_hash text,
  user_agent text,
  accepted_at timestamptz not null default now(),
  unique (proposal_version_id)
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  title text not null default 'Contrato de viaje',
  status text not null default 'draft',
  external_url text,
  signed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  document_kind text not null default 'proforma',
  document_number text,
  status text not null default 'draft',
  amount numeric not null default 0,
  tax_amount numeric not null default 0,
  currency text not null default 'EUR',
  issued_at timestamptz,
  external_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.suppliers add column if not exists category text;
alter table public.suppliers add column if not exists billing_address jsonb not null default '{}'::jsonb;
alter table public.suppliers add column if not exists active boolean not null default true;

create index if not exists idx_proposal_acceptances_org_case on public.proposal_acceptances(organization_id, case_id);
create index if not exists idx_contracts_org_case on public.contracts(organization_id, case_id);
create index if not exists idx_fiscal_documents_org_case on public.fiscal_documents(organization_id, case_id);
create unique index if not exists suppliers_org_name_unique on public.suppliers(organization_id, lower(name));

alter table public.proposal_acceptances enable row level security;
alter table public.contracts enable row level security;
alter table public.fiscal_documents enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='proposal_acceptances' and policyname='proposal_acceptances_org_access') then
    create policy proposal_acceptances_org_access on public.proposal_acceptances for all to authenticated using (exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.organization_id=proposal_acceptances.organization_id)) with check (exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.organization_id=proposal_acceptances.organization_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='contracts' and policyname='contracts_org_access') then
    create policy contracts_org_access on public.contracts for all to authenticated using (exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.organization_id=contracts.organization_id)) with check (exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.organization_id=contracts.organization_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='fiscal_documents' and policyname='fiscal_documents_org_access') then
    create policy fiscal_documents_org_access on public.fiscal_documents for all to authenticated using (exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.organization_id=fiscal_documents.organization_id)) with check (exists (select 1 from public.profiles p where p.user_id=auth.uid() and p.organization_id=fiscal_documents.organization_id));
  end if;
end $$;

