alter table public.routsify_settings add column if not exists default_value jsonb;
alter table public.routsify_settings add column if not exists value_type text;
alter table public.routsify_settings add column if not exists scope text;
alter table public.routsify_settings add column if not exists editable boolean not null default true;
alter table public.routsify_settings add column if not exists requires_recalculation boolean not null default false;
alter table public.routsify_settings add column if not exists affected_modules text[] not null default '{}'::text[];
create unique index if not exists routsify_settings_org_key_unique on public.routsify_settings(organization_id, key);
alter table public.routsify_settings_audit_log add column if not exists setting_key text;
alter table public.routsify_settings_audit_log add column if not exists event_name text;
alter table public.routsify_settings_audit_log add column if not exists requires_recalculation boolean not null default false;

