create table if not exists public.integration_repair_staging (
  run_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  external_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (run_id, provider, external_id)
);

create index if not exists integration_repair_staging_provider_idx
  on public.integration_repair_staging(organization_id, provider, run_id);

alter table public.integration_repair_staging enable row level security;

create table if not exists public.integration_repair_backups (
  run_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (run_id, entity_type, entity_id)
);

create index if not exists integration_repair_backups_provider_idx
  on public.integration_repair_backups(organization_id, provider, run_id);

alter table public.integration_repair_backups enable row level security;

