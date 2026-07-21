create table if not exists public.notification_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  notification_key text not null check (length(notification_key) between 3 and 240),
  read_at timestamptz null,
  dismissed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, notification_key)
);

create index if not exists notification_receipts_user_idx
  on public.notification_receipts (organization_id, user_id, updated_at desc);

alter table public.notification_receipts enable row level security;
revoke all on table public.notification_receipts from anon, authenticated;
grant all on table public.notification_receipts to service_role;

