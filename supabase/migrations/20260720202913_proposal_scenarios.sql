-- Internal budget simulations. A scenario is not a sent or accepted proposal version.

create table if not exists public.proposal_scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  source_version_id uuid not null references public.proposal_versions(id) on delete cascade,
  name text not null,
  scenario_type text not null default 'custom',
  description text,
  target_margin_pct numeric(6,2) not null,
  total_cost numeric(12,2) not null default 0,
  total_sale numeric(12,2) not null default 0,
  profit numeric(12,2) not null default 0,
  margin_pct numeric(6,2) not null default 0,
  lines_snapshot jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  created_by uuid,
  applied_at timestamptz,
  applied_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint proposal_scenarios_name_check check (length(btrim(name)) between 2 and 120),
  constraint proposal_scenarios_type_check check (scenario_type = any (array['economical','recommended','premium','custom']::text[])),
  constraint proposal_scenarios_margin_check check (target_margin_pct between 0 and 80),
  constraint proposal_scenarios_status_check check (status = any (array['draft','selected','archived']::text[])),
  constraint proposal_scenarios_snapshot_check check (jsonb_typeof(lines_snapshot) = 'array')
);

create index if not exists proposal_scenarios_proposal_idx on public.proposal_scenarios(organization_id, proposal_id, status, created_at desc);
create index if not exists proposal_scenarios_source_idx on public.proposal_scenarios(source_version_id);

alter table public.proposal_scenarios enable row level security;

drop policy if exists proposal_scenarios_select_scoped on public.proposal_scenarios;
create policy proposal_scenarios_select_scoped on public.proposal_scenarios for select using (
  organization_id = (select public.current_org_id())
  and (select public.current_app_role()) = any (array['admin','direction','sales','operations','billing','viewer']::public.app_role[])
);
drop policy if exists proposal_scenarios_insert_scoped on public.proposal_scenarios;
create policy proposal_scenarios_insert_scoped on public.proposal_scenarios for insert with check (
  organization_id = (select public.current_org_id())
  and (select public.current_app_role()) = any (array['admin','direction','sales']::public.app_role[])
);
drop policy if exists proposal_scenarios_update_scoped on public.proposal_scenarios;
create policy proposal_scenarios_update_scoped on public.proposal_scenarios for update using (
  organization_id = (select public.current_org_id())
  and (select public.current_app_role()) = any (array['admin','direction','sales']::public.app_role[])
) with check (organization_id = (select public.current_org_id()));
drop policy if exists proposal_scenarios_delete_scoped on public.proposal_scenarios;
create policy proposal_scenarios_delete_scoped on public.proposal_scenarios for delete using (
  organization_id = (select public.current_org_id())
  and (select public.current_app_role()) = any (array['admin','direction']::public.app_role[])
);

