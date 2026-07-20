-- Internal supplier intelligence. Holded remains the external portal and accounting source.

alter table public.suppliers add column if not exists preferred boolean not null default false;
alter table public.suppliers add column if not exists risk_level text not null default 'low';
alter table public.suppliers add column if not exists reliability_score integer not null default 70;
alter table public.suppliers add column if not exists average_rating numeric(3,2);
alter table public.suppliers add column if not exists payment_terms_days integer not null default 0;
alter table public.suppliers add column if not exists default_currency text not null default 'EUR';
alter table public.suppliers add column if not exists service_regions text[] not null default '{}'::text[];
alter table public.suppliers add column if not exists cancellation_policy text;
alter table public.suppliers add column if not exists emergency_contact jsonb not null default '{}'::jsonb;
alter table public.suppliers add column if not exists profile_updated_at timestamptz;

alter table public.suppliers drop constraint if exists suppliers_risk_level_check;
alter table public.suppliers add constraint suppliers_risk_level_check check (risk_level = any (array['low','medium','high']::text[]));
alter table public.suppliers drop constraint if exists suppliers_reliability_score_check;
alter table public.suppliers add constraint suppliers_reliability_score_check check (reliability_score between 0 and 100);
alter table public.suppliers drop constraint if exists suppliers_average_rating_check;
alter table public.suppliers add constraint suppliers_average_rating_check check (average_rating is null or average_rating between 0 and 5);
alter table public.suppliers drop constraint if exists suppliers_payment_terms_days_check;
alter table public.suppliers add constraint suppliers_payment_terms_days_check check (payment_terms_days between 0 and 365);
alter table public.suppliers drop constraint if exists suppliers_default_currency_check;
alter table public.suppliers add constraint suppliers_default_currency_check check (default_currency ~ '^[A-Z]{3}$');
alter table public.suppliers drop constraint if exists suppliers_emergency_contact_object_check;
alter table public.suppliers add constraint suppliers_emergency_contact_object_check check (jsonb_typeof(emergency_contact) = 'object');

create table if not exists public.supplier_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  name text not null,
  category text,
  destination text,
  currency text not null default 'EUR',
  unit text,
  base_cost numeric(12,2),
  tax_rate numeric(6,2),
  valid_from date,
  valid_until date,
  active boolean not null default true,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_services_name_check check (length(btrim(name)) between 2 and 160),
  constraint supplier_services_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint supplier_services_cost_check check (base_cost is null or base_cost >= 0),
  constraint supplier_services_tax_check check (tax_rate is null or tax_rate between 0 and 100),
  constraint supplier_services_dates_check check (valid_from is null or valid_until is null or valid_from <= valid_until)
);

create table if not exists public.supplier_incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  case_id uuid references public.cases(id) on delete set null,
  severity text not null default 'medium',
  status text not null default 'open',
  title text not null,
  description text,
  occurred_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_incidents_severity_check check (severity = any (array['low','medium','high','critical']::text[])),
  constraint supplier_incidents_status_check check (status = any (array['open','monitoring','resolved']::text[])),
  constraint supplier_incidents_title_check check (length(btrim(title)) between 2 and 200)
);

create index if not exists suppliers_org_preferred_idx on public.suppliers(organization_id, preferred, risk_level, reliability_score desc);
create index if not exists supplier_services_supplier_idx on public.supplier_services(organization_id, supplier_id, active, destination);
create index if not exists supplier_incidents_supplier_idx on public.supplier_incidents(organization_id, supplier_id, status, occurred_at desc);

alter table public.supplier_services enable row level security;
alter table public.supplier_incidents enable row level security;

drop policy if exists supplier_services_select_scoped on public.supplier_services;
create policy supplier_services_select_scoped on public.supplier_services for select using (
  organization_id = (select public.current_org_id())
  and (select public.current_app_role()) = any (array['admin','direction','sales','operations','billing','viewer']::public.app_role[])
);
drop policy if exists supplier_services_insert_scoped on public.supplier_services;
create policy supplier_services_insert_scoped on public.supplier_services for insert with check (
  organization_id = (select public.current_org_id())
  and (select public.current_app_role()) = any (array['admin','direction','operations','billing']::public.app_role[])
);
drop policy if exists supplier_services_update_scoped on public.supplier_services;
create policy supplier_services_update_scoped on public.supplier_services for update using (
  organization_id = (select public.current_org_id())
  and (select public.current_app_role()) = any (array['admin','direction','operations','billing']::public.app_role[])
) with check (organization_id = (select public.current_org_id()));
drop policy if exists supplier_services_delete_scoped on public.supplier_services;
create policy supplier_services_delete_scoped on public.supplier_services for delete using (
  organization_id = (select public.current_org_id())
  and (select public.current_app_role()) = any (array['admin','direction']::public.app_role[])
);

drop policy if exists supplier_incidents_select_scoped on public.supplier_incidents;
create policy supplier_incidents_select_scoped on public.supplier_incidents for select using (
  organization_id = (select public.current_org_id())
  and (select public.current_app_role()) = any (array['admin','direction','sales','operations','billing','viewer']::public.app_role[])
);
drop policy if exists supplier_incidents_insert_scoped on public.supplier_incidents;
create policy supplier_incidents_insert_scoped on public.supplier_incidents for insert with check (
  organization_id = (select public.current_org_id())
  and (select public.current_app_role()) = any (array['admin','direction','operations','billing']::public.app_role[])
);
drop policy if exists supplier_incidents_update_scoped on public.supplier_incidents;
create policy supplier_incidents_update_scoped on public.supplier_incidents for update using (
  organization_id = (select public.current_org_id())
  and (select public.current_app_role()) = any (array['admin','direction','operations','billing']::public.app_role[])
) with check (organization_id = (select public.current_org_id()));
drop policy if exists supplier_incidents_delete_scoped on public.supplier_incidents;
create policy supplier_incidents_delete_scoped on public.supplier_incidents for delete using (
  organization_id = (select public.current_org_id())
  and (select public.current_app_role()) = any (array['admin','direction']::public.app_role[])
);
