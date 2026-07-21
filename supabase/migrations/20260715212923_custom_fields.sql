create table if not exists public.custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('client','case')),
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  label text not null check (length(btrim(label)) between 1 and 120),
  field_type text not null check (field_type in ('text','textarea','number','date','boolean','select')),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  required boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, entity_type, key)
);

create index if not exists custom_field_definitions_org_entity_active_idx
  on public.custom_field_definitions (organization_id, entity_type, active, sort_order, created_at);

create table if not exists public.custom_field_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  definition_id uuid not null references public.custom_field_definitions(id) on delete cascade,
  entity_type text not null check (entity_type in ('client','case')),
  entity_id uuid not null,
  value jsonb null,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, definition_id, entity_id)
);

create index if not exists custom_field_values_org_entity_idx
  on public.custom_field_values (organization_id, entity_type, entity_id);

create index if not exists custom_field_values_definition_idx
  on public.custom_field_values (organization_id, definition_id);

alter table public.custom_field_definitions enable row level security;
alter table public.custom_field_values enable row level security;

revoke all on table public.custom_field_definitions from anon, authenticated;
revoke all on table public.custom_field_values from anon, authenticated;

grant all on table public.custom_field_definitions to service_role;
grant all on table public.custom_field_values to service_role;

