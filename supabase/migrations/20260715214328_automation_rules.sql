create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  enabled boolean not null default true,
  trigger_type text not null check (trigger_type in ('case_inactive','trip_starts_in')),
  trigger_config jsonb not null default '{}'::jsonb check (jsonb_typeof(trigger_config) = 'object'),
  action_type text not null check (action_type in ('create_task')),
  action_config jsonb not null default '{}'::jsonb check (jsonb_typeof(action_config) = 'object'),
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists automation_rules_org_enabled_idx
  on public.automation_rules (organization_id, enabled, trigger_type, updated_at desc);

create table if not exists public.automation_executions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid not null references public.automation_rules(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  occurrence_key text not null check (length(occurrence_key) between 3 and 300),
  status text not null check (status in ('done','failed')),
  result jsonb not null default '{}'::jsonb check (jsonb_typeof(result) = 'object'),
  error text null,
  executed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rule_id, occurrence_key)
);

create index if not exists automation_executions_org_rule_idx
  on public.automation_executions (organization_id, rule_id, executed_at desc);

alter table public.automation_rules enable row level security;
alter table public.automation_executions enable row level security;
revoke all on table public.automation_rules from anon, authenticated;
revoke all on table public.automation_executions from anon, authenticated;
grant all on table public.automation_rules to service_role;
grant all on table public.automation_executions to service_role;

