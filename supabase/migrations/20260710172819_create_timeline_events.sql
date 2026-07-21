create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  case_id uuid,
  client_id uuid,
  event_type text not null,
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_timeline_org_case_created on public.timeline_events(organization_id, case_id, created_at desc);
alter table public.timeline_events enable row level security;

