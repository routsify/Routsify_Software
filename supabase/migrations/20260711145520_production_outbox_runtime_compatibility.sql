alter table public.integration_outbox
  add column if not exists channel text,
  add column if not exists related_case_id uuid,
  add column if not exists status text not null default 'pending',
  add column if not exists max_attempts integer not null default 3,
  add column if not exists risk text not null default 'low',
  add column if not exists business_rule text,
  add column if not exists next_action text,
  add column if not exists last_attempt_at timestamptz;

alter table public.integration_outbox
  alter column provider set default 'routsify',
  alter column entity_type set default 'integration_event',
  alter column sync_status set default 'pending';

update public.integration_outbox set channel = coalesce(channel, provider) where channel is null;

create unique index if not exists integration_outbox_routsify_idempotency_idx
  on public.integration_outbox(organization_id, channel, event_type, idempotency_key);

create table if not exists public.integration_runs (
  id uuid primary key default gen_random_uuid(),
  integration text not null,
  status text not null default 'processing',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  attempts integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.integration_runs enable row level security;

