create table if not exists public.routsify_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  module text not null,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  label text,
  description text,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, module, key)
);
create index if not exists idx_routsify_settings_org_module on public.routsify_settings(organization_id, module);
alter table public.routsify_settings enable row level security;

