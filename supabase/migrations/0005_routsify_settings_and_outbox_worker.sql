create table if not exists public.routsify_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  module text not null,
  value jsonb not null default 'null'::jsonb,
  default_value jsonb not null default 'null'::jsonb,
  value_type text not null default 'string',
  scope text not null default 'global',
  editable boolean not null default true,
  requires_recalculation boolean not null default false,
  affected_modules text[] not null default '{}',
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

create table if not exists public.routsify_settings_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  setting_key text not null,
  module text not null,
  old_value jsonb,
  new_value jsonb,
  actor_id uuid,
  event_name text not null default 'settings.updated',
  requires_recalculation boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.integration_outbox add column if not exists locked_at timestamptz;
alter table public.integration_outbox add column if not exists locked_by text;
alter table public.integration_outbox add column if not exists processed_at timestamptz;
create index if not exists integration_outbox_worker_idx on public.integration_outbox(organization_id, status, created_at);

alter table public.documents add column if not exists mime_type text;
alter table public.documents add column if not exists size_bytes bigint;
alter table public.documents add column if not exists checksum text;
alter table public.documents add column if not exists storage_path text;

alter table public.routsify_settings enable row level security;
alter table public.routsify_settings_audit_log enable row level security;

create policy routsify_settings_select on public.routsify_settings for select using (public.has_org_access(organization_id));
create policy routsify_settings_admin_write on public.routsify_settings for all using (public.has_org_access(organization_id) and public.has_role(array['admin','direction'])) with check (public.has_org_access(organization_id) and public.has_role(array['admin','direction']));
create policy routsify_settings_audit_select on public.routsify_settings_audit_log for select using (public.has_org_access(organization_id) and public.has_role(array['admin','direction']));
create policy routsify_settings_audit_insert on public.routsify_settings_audit_log for insert with check (public.has_org_access(organization_id) and public.has_role(array['admin','direction']));
