alter table public.documents add column if not exists case_id uuid;
alter table public.documents add column if not exists title text;
alter table public.documents add column if not exists type text;
alter table public.documents add column if not exists status text not null default 'reviewing';
alter table public.documents add column if not exists file_name text;
alter table public.documents add column if not exists checksum text;
alter table public.documents add column if not exists sensitivity text not null default 'private';
alter table public.documents add column if not exists access_purpose text;
alter table public.documents add column if not exists required boolean not null default false;
create table if not exists public.document_access_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  document_id uuid,
  case_id uuid,
  actor_id uuid,
  purpose text not null,
  action text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_document_access_log_org_created on public.document_access_log(organization_id, created_at desc);
alter table public.document_access_log enable row level security;

