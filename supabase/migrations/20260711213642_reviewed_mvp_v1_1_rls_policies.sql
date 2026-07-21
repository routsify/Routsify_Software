alter table public.formula_versions enable row level security;
drop policy if exists formula_versions_org_access on public.formula_versions;
create policy formula_versions_org_access on public.formula_versions for all using (organization_id=public.current_org_id()) with check (organization_id=public.current_org_id());

alter table public.case_sequences enable row level security;
drop policy if exists case_sequences_org_access on public.case_sequences;
create policy case_sequences_org_access on public.case_sequences for all using (organization_id=public.current_org_id()) with check (organization_id=public.current_org_id());

alter table public.holded_sync enable row level security;
drop policy if exists holded_sync_org_access on public.holded_sync;
create policy holded_sync_org_access on public.holded_sync for all using (organization_id=public.current_org_id()) with check (organization_id=public.current_org_id());

alter table public.purchase_match_candidates enable row level security;
drop policy if exists purchase_match_candidates_org_access on public.purchase_match_candidates;
create policy purchase_match_candidates_org_access on public.purchase_match_candidates for all using (organization_id=public.current_org_id()) with check (organization_id=public.current_org_id());

alter table public.contract_versions enable row level security;
drop policy if exists contract_versions_org_access on public.contract_versions;
create policy contract_versions_org_access on public.contract_versions for all using (organization_id=public.current_org_id()) with check (organization_id=public.current_org_id());

alter table public.signature_evidence enable row level security;
drop policy if exists signature_evidence_org_access on public.signature_evidence;
create policy signature_evidence_org_access on public.signature_evidence for all using (organization_id=public.current_org_id()) with check (organization_id=public.current_org_id());

alter table public.payment_links enable row level security;
drop policy if exists payment_links_org_access on public.payment_links;
create policy payment_links_org_access on public.payment_links for all using (organization_id=public.current_org_id()) with check (organization_id=public.current_org_id());

alter table public.payment_events enable row level security;
drop policy if exists payment_events_org_access on public.payment_events;
create policy payment_events_org_access on public.payment_events for all using (organization_id=public.current_org_id()) with check (organization_id=public.current_org_id());

alter table public.ocr_runs enable row level security;
drop policy if exists ocr_runs_org_access on public.ocr_runs;
create policy ocr_runs_org_access on public.ocr_runs for all using (organization_id=public.current_org_id()) with check (organization_id=public.current_org_id());

alter table public.ocr_fields enable row level security;
drop policy if exists ocr_fields_org_access on public.ocr_fields;
create policy ocr_fields_org_access on public.ocr_fields for all using (organization_id=public.current_org_id()) with check (organization_id=public.current_org_id());

alter table public.case_stage_events enable row level security;
drop policy if exists case_stage_events_org_access on public.case_stage_events;
create policy case_stage_events_org_access on public.case_stage_events for all using (organization_id=public.current_org_id()) with check (organization_id=public.current_org_id());

