drop policy if exists documents_org_access on public.documents;
drop policy if exists documents_select_scoped on public.documents;
drop policy if exists documents_insert_scoped on public.documents;
drop policy if exists documents_update_scoped on public.documents;
drop policy if exists documents_delete_scoped on public.documents;
create policy documents_select_scoped on public.documents for select to authenticated
using (organization_id=(select public.current_org_id()) and ((coalesce(sensitivity,'private')<>'sensitive' and owner_type<>'traveler') or (select public.current_app_role()) in ('admin'::public.app_role,'sales'::public.app_role)));
create policy documents_insert_scoped on public.documents for insert to authenticated
with check (organization_id=(select public.current_org_id()) and (select public.current_app_role()) in ('admin'::public.app_role,'direction'::public.app_role,'sales'::public.app_role,'operations'::public.app_role,'billing'::public.app_role) and ((coalesce(sensitivity,'private')<>'sensitive' and owner_type<>'traveler') or (select public.current_app_role()) in ('admin'::public.app_role,'sales'::public.app_role)));
create policy documents_update_scoped on public.documents for update to authenticated
using (organization_id=(select public.current_org_id()) and ((coalesce(sensitivity,'private')<>'sensitive' and owner_type<>'traveler') or (select public.current_app_role()) in ('admin'::public.app_role,'sales'::public.app_role)))
with check (organization_id=(select public.current_org_id()) and ((coalesce(sensitivity,'private')<>'sensitive' and owner_type<>'traveler') or (select public.current_app_role()) in ('admin'::public.app_role,'sales'::public.app_role)));
create policy documents_delete_scoped on public.documents for delete to authenticated
using (organization_id=(select public.current_org_id()) and (select public.current_app_role()) in ('admin'::public.app_role,'sales'::public.app_role));

drop policy if exists ocr_runs_org_access on public.ocr_runs;
drop policy if exists ocr_runs_sensitive_access on public.ocr_runs;
create policy ocr_runs_sensitive_access on public.ocr_runs for all to authenticated
using (organization_id=(select public.current_org_id()) and (select public.current_app_role()) in ('admin'::public.app_role,'sales'::public.app_role))
with check (organization_id=(select public.current_org_id()) and (select public.current_app_role()) in ('admin'::public.app_role,'sales'::public.app_role));
drop policy if exists ocr_fields_org_access on public.ocr_fields;
drop policy if exists ocr_fields_sensitive_access on public.ocr_fields;
create policy ocr_fields_sensitive_access on public.ocr_fields for all to authenticated
using (organization_id=(select public.current_org_id()) and (select public.current_app_role()) in ('admin'::public.app_role,'sales'::public.app_role))
with check (organization_id=(select public.current_org_id()) and (select public.current_app_role()) in ('admin'::public.app_role,'sales'::public.app_role));

