create index if not exists clients_org_phone_idx on public.clients(organization_id,phone_normalized) where phone_normalized is not null;
create index if not exists clients_org_email_idx on public.clients(organization_id,email_normalized) where email_normalized is not null;
create index if not exists cases_org_status_priority_idx on public.cases(organization_id,status,priority,last_activity_at desc);
create index if not exists case_stage_events_case_idx on public.case_stage_events(organization_id,case_id,entered_at);
create index if not exists budget_lines_version_included_idx on public.budget_lines(proposal_version_id,included,sort_order);
create index if not exists expected_purchases_case_active_idx on public.expected_purchases(organization_id,case_id,active,status);
create index if not exists holded_sync_pending_idx on public.holded_sync(organization_id,sync_status,updated_at);
create index if not exists purchase_candidates_purchase_idx on public.purchase_match_candidates(organization_id,expected_purchase_id,score desc);
create index if not exists payment_links_case_idx on public.payment_links(organization_id,case_id,status);
create index if not exists ocr_runs_document_idx on public.ocr_runs(organization_id,document_id,created_at desc);
create index if not exists documents_retention_due_idx on public.documents(organization_id,purge_after,status) where purged_at is null;

update public.cases set last_activity_at=coalesce(last_event_at,updated_at,created_at,now()) where last_activity_at is null;
update public.budget_lines set included=true where included is null;
update public.expected_purchases set provider_hash=encode(digest(lower(coalesce(supplier_name,'')),'sha256'),'hex') where provider_hash is null;

update public.budget_lines bl
set expected_purchase_id=ep.id
from public.expected_purchases ep
where ep.budget_line_id=bl.id and bl.expected_purchase_id is null;

do $$ begin
  alter table public.budget_lines add constraint budget_lines_expected_purchase_fk foreign key (expected_purchase_id) references public.expected_purchases(id) on delete set null;
exception when duplicate_object then null; end $$;

