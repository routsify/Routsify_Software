-- Operational communication templates and follow-up history.
-- The feature prepares and records messages. It does not send automatically
-- until an outbound provider is configured explicitly.

create table if not exists public.communication_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  name text not null,
  audience text not null check (audience in ('client','supplier')),
  channel text not null check (channel in ('email','whatsapp')),
  subject_template text,
  body_template text not null,
  active boolean not null default true,
  system_template boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key, channel)
);

create table if not exists public.communication_followups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid references public.cases(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  proposal_id uuid references public.proposals(id) on delete set null,
  contract_id uuid references public.contracts(id) on delete set null,
  purchase_id uuid references public.expected_purchases(id) on delete set null,
  template_id uuid references public.communication_templates(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  kind text not null,
  channel text not null check (channel in ('email','whatsapp')),
  recipient_name text,
  recipient_email text,
  recipient_phone text,
  subject text,
  body text not null,
  status text not null default 'planned' check (status in ('planned','prepared','sent','answered','cancelled')),
  due_at timestamptz not null,
  sent_at timestamptz,
  answered_at timestamptz,
  cancelled_at timestamptz,
  thread_key text not null,
  sequence_step integer not null default 1 check (sequence_step > 0),
  next_followup_at timestamptz,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create index if not exists communication_templates_org_active_idx
  on public.communication_templates (organization_id, active, audience, channel);
create index if not exists communication_followups_org_status_due_idx
  on public.communication_followups (organization_id, status, due_at);
create index if not exists communication_followups_case_idx
  on public.communication_followups (organization_id, case_id, created_at desc);
create index if not exists communication_followups_client_idx
  on public.communication_followups (organization_id, client_id, created_at desc);
create index if not exists communication_followups_supplier_idx
  on public.communication_followups (organization_id, supplier_id, created_at desc);
create index if not exists communication_followups_thread_idx
  on public.communication_followups (organization_id, thread_key, sequence_step desc);

alter table public.communication_templates enable row level security;
alter table public.communication_followups enable row level security;

drop policy if exists communication_templates_select_scoped on public.communication_templates;
create policy communication_templates_select_scoped on public.communication_templates
for select to authenticated
using (
  organization_id = (select public.current_org_id())
  and (select public.current_app_role()) = any (array['admin','direction','sales','operations','billing']::public.app_role[])
);

drop policy if exists communication_templates_write_scoped on public.communication_templates;
create policy communication_templates_write_scoped on public.communication_templates
for all to authenticated
using (
  organization_id = (select public.current_org_id())
  and (select public.current_app_role()) = any (array['admin','direction']::public.app_role[])
)
with check (
  organization_id = (select public.current_org_id())
  and (select public.current_app_role()) = any (array['admin','direction']::public.app_role[])
);

drop policy if exists communication_followups_select_scoped on public.communication_followups;
create policy communication_followups_select_scoped on public.communication_followups
for select to authenticated
using (
  organization_id = (select public.current_org_id())
  and (select public.current_app_role()) = any (array['admin','direction','sales','operations','billing']::public.app_role[])
);

drop policy if exists communication_followups_write_scoped on public.communication_followups;
create policy communication_followups_write_scoped on public.communication_followups
for all to authenticated
using (
  organization_id = (select public.current_org_id())
  and (select public.current_app_role()) = any (array['admin','direction','sales','operations','billing']::public.app_role[])
)
with check (
  organization_id = (select public.current_org_id())
  and (select public.current_app_role()) = any (array['admin','direction','sales','operations','billing']::public.app_role[])
);

grant select, insert, update, delete on public.communication_templates to authenticated;
grant select, insert, update, delete on public.communication_followups to authenticated;
grant all on public.communication_templates to service_role;
grant all on public.communication_followups to service_role;
