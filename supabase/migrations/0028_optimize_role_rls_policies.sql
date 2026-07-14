-- Remove duplicate proposal index and split write policies so SELECT has one permissive policy.

drop index if exists public.proposals_one_per_case_uidx;

-- Leads
DROP POLICY IF EXISTS leads_write_scoped ON public.leads;
CREATE POLICY leads_insert_scoped ON public.leads FOR INSERT TO authenticated
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations']::public.app_role[]));
CREATE POLICY leads_update_scoped ON public.leads FOR UPDATE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations']::public.app_role[]))
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations']::public.app_role[]));
CREATE POLICY leads_delete_scoped ON public.leads FOR DELETE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction']::public.app_role[]));

-- Bookings
DROP POLICY IF EXISTS bookings_write_scoped ON public.bookings;
CREATE POLICY bookings_insert_scoped ON public.bookings FOR INSERT TO authenticated
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations']::public.app_role[]));
CREATE POLICY bookings_update_scoped ON public.bookings FOR UPDATE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations']::public.app_role[]))
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations']::public.app_role[]));
CREATE POLICY bookings_delete_scoped ON public.bookings FOR DELETE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction']::public.app_role[]));

-- Proposals
DROP POLICY IF EXISTS proposals_write_scoped ON public.proposals;
CREATE POLICY proposals_insert_scoped ON public.proposals FOR INSERT TO authenticated
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales']::public.app_role[]));
CREATE POLICY proposals_update_scoped ON public.proposals FOR UPDATE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales']::public.app_role[]))
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales']::public.app_role[]));
CREATE POLICY proposals_delete_scoped ON public.proposals FOR DELETE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction']::public.app_role[]));

-- Proposal versions
DROP POLICY IF EXISTS proposal_versions_write_scoped ON public.proposal_versions;
CREATE POLICY proposal_versions_insert_scoped ON public.proposal_versions FOR INSERT TO authenticated
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales']::public.app_role[]));
CREATE POLICY proposal_versions_update_scoped ON public.proposal_versions FOR UPDATE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales']::public.app_role[]))
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales']::public.app_role[]));
CREATE POLICY proposal_versions_delete_scoped ON public.proposal_versions FOR DELETE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction']::public.app_role[]));

-- Budget lines
DROP POLICY IF EXISTS budget_lines_write_scoped ON public.budget_lines;
CREATE POLICY budget_lines_insert_scoped ON public.budget_lines FOR INSERT TO authenticated
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales']::public.app_role[]));
CREATE POLICY budget_lines_update_scoped ON public.budget_lines FOR UPDATE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales']::public.app_role[]))
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales']::public.app_role[]));
CREATE POLICY budget_lines_delete_scoped ON public.budget_lines FOR DELETE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales']::public.app_role[]));

-- Expected purchases
DROP POLICY IF EXISTS expected_purchases_write_scoped ON public.expected_purchases;
CREATE POLICY expected_purchases_insert_scoped ON public.expected_purchases FOR INSERT TO authenticated
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[]));
CREATE POLICY expected_purchases_update_scoped ON public.expected_purchases FOR UPDATE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[]))
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[]));
CREATE POLICY expected_purchases_delete_scoped ON public.expected_purchases FOR DELETE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction']::public.app_role[]));

-- Supplier invoices
DROP POLICY IF EXISTS supplier_invoices_write_scoped ON public.supplier_invoices;
CREATE POLICY supplier_invoices_insert_scoped ON public.supplier_invoices FOR INSERT TO authenticated
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[]));
CREATE POLICY supplier_invoices_update_scoped ON public.supplier_invoices FOR UPDATE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[]))
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[]));
CREATE POLICY supplier_invoices_delete_scoped ON public.supplier_invoices FOR DELETE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','billing']::public.app_role[]));

-- Contracts
DROP POLICY IF EXISTS contracts_write_scoped ON public.contracts;
CREATE POLICY contracts_insert_scoped ON public.contracts FOR INSERT TO authenticated
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[]));
CREATE POLICY contracts_update_scoped ON public.contracts FOR UPDATE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[]))
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[]));
CREATE POLICY contracts_delete_scoped ON public.contracts FOR DELETE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction']::public.app_role[]));

-- Payments
DROP POLICY IF EXISTS payments_write_scoped ON public.payments;
CREATE POLICY payments_insert_scoped ON public.payments FOR INSERT TO authenticated
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','billing']::public.app_role[]));
CREATE POLICY payments_update_scoped ON public.payments FOR UPDATE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','billing']::public.app_role[]))
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','billing']::public.app_role[]));
CREATE POLICY payments_delete_scoped ON public.payments FOR DELETE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction']::public.app_role[]));

-- Payment links
DROP POLICY IF EXISTS payment_links_write_scoped ON public.payment_links;
CREATE POLICY payment_links_insert_scoped ON public.payment_links FOR INSERT TO authenticated
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales']::public.app_role[]));
CREATE POLICY payment_links_update_scoped ON public.payment_links FOR UPDATE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales']::public.app_role[]))
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales']::public.app_role[]));
CREATE POLICY payment_links_delete_scoped ON public.payment_links FOR DELETE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction']::public.app_role[]));

-- Billing documents
DROP POLICY IF EXISTS billing_documents_write_scoped ON public.billing_documents;
CREATE POLICY billing_documents_insert_scoped ON public.billing_documents FOR INSERT TO authenticated
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','billing']::public.app_role[]));
CREATE POLICY billing_documents_update_scoped ON public.billing_documents FOR UPDATE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','billing']::public.app_role[]))
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','billing']::public.app_role[]));
CREATE POLICY billing_documents_delete_scoped ON public.billing_documents FOR DELETE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction']::public.app_role[]));

-- Travelers
DROP POLICY IF EXISTS travelers_write_scoped ON public.travelers;
CREATE POLICY travelers_insert_scoped ON public.travelers FOR INSERT TO authenticated
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations']::public.app_role[]));
CREATE POLICY travelers_update_scoped ON public.travelers FOR UPDATE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations']::public.app_role[]))
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations']::public.app_role[]));
CREATE POLICY travelers_delete_scoped ON public.travelers FOR DELETE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction']::public.app_role[]));

-- Tasks
DROP POLICY IF EXISTS tasks_write_scoped ON public.tasks;
CREATE POLICY tasks_insert_scoped ON public.tasks FOR INSERT TO authenticated
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[]));
CREATE POLICY tasks_update_scoped ON public.tasks FOR UPDATE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[]))
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[]));
CREATE POLICY tasks_delete_scoped ON public.tasks FOR DELETE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction']::public.app_role[]));

-- Timeline
DROP POLICY IF EXISTS timeline_events_write_scoped ON public.timeline_events;
CREATE POLICY timeline_events_insert_scoped ON public.timeline_events FOR INSERT TO authenticated
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[]));
CREATE POLICY timeline_events_update_scoped ON public.timeline_events FOR UPDATE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[]))
WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[]));
CREATE POLICY timeline_events_delete_scoped ON public.timeline_events FOR DELETE TO authenticated
USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction']::public.app_role[]));
