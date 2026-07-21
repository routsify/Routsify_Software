create table if not exists public.organization_secrets (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  secret_key text not null check (secret_key in ('holded_api_key','openai_api_key')),
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id,secret_key)
);
alter table public.organization_secrets enable row level security;
revoke all on public.organization_secrets from anon,authenticated;
grant all on public.organization_secrets to service_role;
create index if not exists organization_secrets_updated_idx on public.organization_secrets(organization_id,updated_at desc);

