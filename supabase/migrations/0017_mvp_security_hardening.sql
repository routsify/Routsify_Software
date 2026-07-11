-- Security hardening after the MVP runtime contract.

alter table public.document_access_log enable row level security;
drop policy if exists document_access_log_org_access on public.document_access_log;
create policy document_access_log_org_access on public.document_access_log
for all using (organization_id = public.current_org_id())
with check (organization_id = public.current_org_id());

alter table public.routsify_settings enable row level security;
drop policy if exists routsify_settings_org_access on public.routsify_settings;
create policy routsify_settings_org_access on public.routsify_settings
for all using (organization_id = public.current_org_id())
with check (organization_id = public.current_org_id());

alter table public.routsify_settings_audit_log enable row level security;
drop policy if exists routsify_settings_audit_log_org_access on public.routsify_settings_audit_log;
create policy routsify_settings_audit_log_org_access on public.routsify_settings_audit_log
for select using (organization_id = public.current_org_id());

alter table public.integration_runs enable row level security;
drop policy if exists integration_runs_service_only on public.integration_runs;
create policy integration_runs_service_only on public.integration_runs
for all using (false) with check (false);

revoke all on function public.generate_expected_purchases_after_acceptance() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.protect_accepted_proposal_status() from public, anon, authenticated;
revoke all on function public.recalculate_proposal_version_totals() from public, anon, authenticated;
grant execute on function public.generate_expected_purchases_after_acceptance() to service_role;
grant execute on function public.handle_new_auth_user() to service_role;
grant execute on function public.protect_accepted_proposal_status() to service_role;
grant execute on function public.recalculate_proposal_version_totals() to service_role;
