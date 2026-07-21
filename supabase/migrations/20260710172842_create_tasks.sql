create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  case_id uuid,
  client_id uuid,
  title text not null,
  status text not null default 'pending',
  priority text not null default 'normal',
  due_at timestamptz,
  assigned_to uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tasks_org_status_due on public.tasks(organization_id, status, due_at);
alter table public.tasks enable row level security;

