create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  module text not null check (module in ('clients','cases')),
  name text not null check (length(btrim(name)) between 1 and 80),
  filters jsonb not null default '{}'::jsonb check (jsonb_typeof(filters) = 'object'),
  columns jsonb not null default '[]'::jsonb check (jsonb_typeof(columns) = 'array'),
  sort jsonb not null default '{}'::jsonb check (jsonb_typeof(sort) = 'object'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, module, name)
);

create index if not exists saved_views_user_module_idx
  on public.saved_views (organization_id, user_id, module, updated_at desc);

create unique index if not exists saved_views_one_default_idx
  on public.saved_views (organization_id, user_id, module)
  where is_default = true;

alter table public.saved_views enable row level security;
revoke all on table public.saved_views from anon, authenticated;
grant all on table public.saved_views to service_role;

