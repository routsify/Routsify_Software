-- Additive observability contract for tenant-scoped integration health.
-- Legacy rows are preserved. They are assigned only when the database has a
-- single unambiguous organization; otherwise they remain unscoped history.

alter table public.integration_runs
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists last_error text,
  add column if not exists kind text not null default 'worker',
  add column if not exists trigger_source text,
  add column if not exists duration_ms integer,
  add column if not exists summary text,
  add column if not exists updated_at timestamptz not null default now();

do $$
declare
  organization_count integer;
  sole_organization uuid;
begin
  select count(*), min(id::text)::uuid
    into organization_count, sole_organization
  from public.organizations;

  if organization_count = 1 then
    update public.integration_runs
    set organization_id = sole_organization,
        updated_at = now()
    where organization_id is null;
  end if;
end $$;

create index if not exists integration_runs_org_integration_started_idx
  on public.integration_runs (organization_id, integration, started_at desc)
  where organization_id is not null;

create index if not exists integration_runs_org_status_started_idx
  on public.integration_runs (organization_id, status, started_at desc)
  where organization_id is not null;

alter table public.integration_runs enable row level security;

drop policy if exists integration_runs_select on public.integration_runs;
drop policy if exists integration_runs_write_admin on public.integration_runs;
drop policy if exists integration_runs_org_access on public.integration_runs;
drop policy if exists integration_runs_insert on public.integration_runs;
drop policy if exists integration_runs_update on public.integration_runs;
drop policy if exists integration_runs_delete on public.integration_runs;
drop policy if exists integration_runs_service_only on public.integration_runs;

create policy integration_runs_service_only on public.integration_runs
for all to authenticated
using (false)
with check (false);

revoke all on table public.integration_runs from anon, authenticated;
grant select, insert, update, delete on table public.integration_runs to service_role;

create or replace function public.claim_integration_outbox_for_org(
  worker_name text,
  batch_size integer default 20,
  target_org uuid default null
)
returns setof public.integration_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_org is null then
    raise exception 'organization_required';
  end if;

  return query
  with selected as (
    select id
    from public.integration_outbox
    where organization_id = target_org
      and status in ('pending', 'queued', 'failed')
      and attempts < max_attempts
      and (next_attempt_at is null or next_attempt_at <= now())
      and (locked_at is null or locked_at < now() - interval '15 minutes')
    order by created_at
    for update skip locked
    limit greatest(1, least(coalesce(batch_size, 20), 100))
  )
  update public.integration_outbox as outbox
  set status = 'processing',
      sync_status = 'processing'::public.sync_status,
      attempts = outbox.attempts + 1,
      last_attempt_at = now(),
      locked_at = now(),
      locked_by = coalesce(worker_name, 'worker')
  from selected
  where outbox.id = selected.id
  returning outbox.*;
end;
$$;

revoke all on function public.claim_integration_outbox_for_org(text, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_integration_outbox_for_org(text, integer, uuid)
  to service_role;
