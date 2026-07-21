drop policy if exists profiles_admin_write on public.profiles;
drop policy if exists profiles_read_own_org on public.profiles;
drop policy if exists profiles_admin_insert on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;
drop policy if exists profiles_admin_delete on public.profiles;

create policy profiles_read_own_org on public.profiles
for select to authenticated
using (organization_id=(select public.current_org_id()) or user_id=(select auth.uid()));

create policy profiles_admin_insert on public.profiles
for insert to authenticated
with check ((select public.current_app_role())='admin'::public.app_role);

create policy profiles_admin_update on public.profiles
for update to authenticated
using ((select public.current_app_role())='admin'::public.app_role)
with check ((select public.current_app_role())='admin'::public.app_role);

create policy profiles_admin_delete on public.profiles
for delete to authenticated
using ((select public.current_app_role())='admin'::public.app_role);

drop policy if exists contracts_org_access on public.contracts;
create policy contracts_org_access on public.contracts
for all to authenticated
using (organization_id=(select public.current_org_id()))
with check (organization_id=(select public.current_org_id()));

drop policy if exists fiscal_documents_org_access on public.fiscal_documents;
create policy fiscal_documents_org_access on public.fiscal_documents
for all to authenticated
using (organization_id=(select public.current_org_id()))
with check (organization_id=(select public.current_org_id()));

drop policy if exists proposal_acceptances_org_access on public.proposal_acceptances;
create policy proposal_acceptances_org_access on public.proposal_acceptances
for all to authenticated
using (organization_id=(select public.current_org_id()))
with check (organization_id=(select public.current_org_id()));

