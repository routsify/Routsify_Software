create table if not exists public.routsify_settings_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module text not null,
  key text,
  old_value jsonb,
  new_value jsonb,
  action text not null default 'update',
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_settings_audit_org_created on public.routsify_settings_audit_log(organization_id, created_at desc);
alter table public.routsify_settings_audit_log enable row level security;

