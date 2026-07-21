alter table public.organization_secrets enable row level security;
drop policy if exists organization_secrets_service_role_only on public.organization_secrets;
create policy organization_secrets_service_role_only
  on public.organization_secrets
  for all
  to service_role
  using (true)
  with check (true);
drop table if exists public.release_payload_chunks;

