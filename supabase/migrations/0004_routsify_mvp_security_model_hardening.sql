-- Routsify MVP hardening: model gaps, profile bootstrap, document access audit and stricter RLS.

alter table public.budget_lines add column if not exists stable_line_id text;
alter table public.budget_lines add column if not exists supplier_id uuid references public.suppliers(id);
alter table public.budget_lines add column if not exists cost_real numeric(12,2);
alter table public.budget_lines add column if not exists margin_rule_id uuid;
alter table public.budget_lines add column if not exists margin_snapshot jsonb not null default '{}'::jsonb;
alter table public.budget_lines add column if not exists economic_locked_at timestamptz;
create unique index if not exists budget_lines_version_stable_line_uidx on public.budget_lines(proposal_version_id, stable_line_id) where stable_line_id is not null;

alter table public.expected_purchases add column if not exists proposal_version_id uuid references public.proposal_versions(id);
alter table public.expected_purchases add column if not exists stable_line_id text;
alter table public.expected_purchases add column if not exists holded_purchase_id text;
alter table public.expected_purchases add column if not exists sync_status text not null default 'manual_review';
alter table public.expected_purchases add column if not exists sync_error text;
create index if not exists expected_purchases_version_idx on public.expected_purchases(proposal_version_id);

alter table public.supplier_invoices add column if not exists holded_purchase_id text;
alter table public.supplier_invoices add column if not exists sync_status text not null default 'manual_review';
alter table public.supplier_invoices add column if not exists sync_error text;

alter table public.documents add column if not exists owner_type text not null default 'case';
alter table public.documents add column if not exists owner_id uuid;
alter table public.documents add column if not exists retention_until timestamptz;
alter table public.documents add column if not exists sensitivity text not null default 'private';
alter table public.documents add column if not exists access_purpose text;
alter table public.documents add column if not exists deleted_at timestamptz;
create index if not exists documents_retention_idx on public.documents(organization_id, retention_until) where deleted_at is null;

create table if not exists public.margin_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  service_type_code text,
  destination text,
  formula text not null default 'margin_on_sale',
  minimum_margin numeric(6,2) not null default 12,
  priority integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fiscal_modes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mode text not null default 'manual_review',
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_access_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  case_id uuid references public.cases(id) on delete set null,
  actor_id uuid,
  purpose text not null,
  action text not null default 'signed_url_issued',
  expires_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.integration_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration text not null,
  status text not null default 'queued',
  started_at timestamptz,
  finished_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  owner_id uuid,
  due_at timestamptz,
  blocker text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  event_type text not null,
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create or replace function public.ensure_profile_for_current_user()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.profiles;
  default_org uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into result from public.profiles where id = auth.uid();
  if result.id is not null then
    return result;
  end if;

  select id into default_org from public.organizations order by created_at asc limit 1;
  if default_org is null then
    insert into public.organizations(name) values ('Routsify') returning id into default_org;
  end if;

  insert into public.profiles(id, organization_id, email, full_name, role)
  values (auth.uid(), default_org, coalesce(auth.email(), ''), coalesce(auth.email(), 'Usuario Routsify'), 'viewer')
  returning * into result;

  return result;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['margin_rules','fiscal_modes','document_access_log','integration_runs','tasks','timeline_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop trigger if exists %I_audit on public.%I', t, t);
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row_change()', t, t);
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select using (public.has_org_access(organization_id))', t, t);
  end loop;
end $$;

-- Replace overly broad generic write policies with minimum-privilege groups.
do $$
declare
  t text;
begin
  foreach t in array array['clients','leads','bookings','cases','proposals','proposal_versions','budget_lines','expected_purchases','supplier_invoices','suppliers','travelers','documents','contracts','payments','billing_documents','integration_outbox','margin_rules','fiscal_modes','document_access_log','integration_runs','tasks','timeline_events'] loop
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);
  end loop;
end $$;

create policy clients_write_sales on public.clients for all using (public.has_org_access(organization_id) and public.has_role(array['admin','direction','sales','operations'])) with check (public.has_org_access(organization_id));
create policy leads_write_sales on public.leads for all using (public.has_org_access(organization_id) and public.has_role(array['admin','direction','sales'])) with check (public.has_org_access(organization_id));
create policy bookings_write_sales on public.bookings for all using (public.has_org_access(organization_id) and public.has_role(array['admin','direction','sales'])) with check (public.has_org_access(organization_id));
create policy cases_write_ops on public.cases for all using (public.has_org_access(organization_id) and public.has_role(array['admin','direction','sales','operations'])) with check (public.has_org_access(organization_id));
create policy budgets_write_sales on public.proposals for all using (public.has_org_access(organization_id) and public.has_role(array['admin','direction','sales'])) with check (public.has_org_access(organization_id));
create policy budget_versions_write_sales on public.proposal_versions for all using (public.has_org_access(organization_id) and public.has_role(array['admin','direction','sales'])) with check (public.has_org_access(organization_id));
create policy budget_lines_write_sales on public.budget_lines for all using (public.has_org_access(organization_id) and public.has_role(array['admin','direction','sales'])) with check (public.has_org_access(organization_id));
create policy purchases_write_ops on public.expected_purchases for all using (public.has_org_access(organization_id) and public.has_role(array['admin','direction','operations','billing'])) with check (public.has_org_access(organization_id));
create policy supplier_invoices_write_ops on public.supplier_invoices for all using (public.has_org_access(organization_id) and public.has_role(array['admin','direction','operations','billing'])) with check (public.has_org_access(organization_id));
create policy suppliers_write_ops on public.suppliers for all using (public.has_org_access(organization_id) and public.has_role(array['admin','direction','operations'])) with check (public.has_org_access(organization_id));
create policy documents_write_ops on public.documents for all using (public.has_org_access(organization_id) and public.has_role(array['admin','direction','operations'])) with check (public.has_org_access(organization_id));
create policy travelers_write_ops on public.travelers for all using (public.has_org_access(organization_id) and public.has_role(array['admin','direction','operations'])) with check (public.has_org_access(organization_id));
create policy contracts_write_ops on public.contracts for all using (public.has_org_access(organization_id) and public.has_role(array['admin','direction','operations','billing'])) with check (public.has_org_access(organization_id));
create policy payments_write_billing on public.payments for all using (public.has_org_access(organization_id) and public.has_role(array['admin','direction','billing'])) with check (public.has_org_access(organization_id));
create policy billing_documents_write_billing on public.billing_documents for all using (public.has_org_access(organization_id) and public.has_role(array['admin','direction','billing'])) with check (public.has_org_access(organization_id));
create policy outbox_write_system on public.integration_outbox for all using (public.has_org_access(organization_id) and public.has_role(array['admin','direction'])) with check (public.has_org_access(organization_id));
create policy document_access_log_insert on public.document_access_log for insert with check (public.has_org_access(organization_id) and public.has_role(array['admin','direction','operations']));
create policy integration_runs_write_admin on public.integration_runs for all using (public.has_org_access(organization_id) and public.has_role(array['admin','direction'])) with check (public.has_org_access(organization_id));
create policy tasks_write_team on public.tasks for all using (public.has_org_access(organization_id) and public.has_role(array['admin','direction','sales','operations','billing'])) with check (public.has_org_access(organization_id));
create policy timeline_events_write_team on public.timeline_events for insert with check (public.has_org_access(organization_id) and public.has_role(array['admin','direction','sales','operations','billing']));

insert into storage.buckets (id, name, public)
values ('travel-documents','travel-documents',false), ('invoices','invoices',false), ('proposal-assets','proposal-assets',true)
on conflict (id) do nothing;
