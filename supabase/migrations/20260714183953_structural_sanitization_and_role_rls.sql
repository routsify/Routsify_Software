-- Structural sanitization: proposal integrity, payment-link schema alignment and role-aware RLS.

alter table public.payment_links
  add column if not exists proposal_version_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.payment_links'::regclass
      and conname = 'payment_links_proposal_version_id_fkey'
  ) then
    alter table public.payment_links
      add constraint payment_links_proposal_version_id_fkey
      foreign key (proposal_version_id)
      references public.proposal_versions(id)
      on delete restrict;
  end if;
end $$;

create index if not exists payment_links_proposal_version_id_idx
  on public.payment_links (proposal_version_id);

create unique index if not exists proposals_one_per_case_uidx
  on public.proposals (organization_id, case_id);

create or replace function public.create_or_get_case_proposal(
  target_org uuid,
  target_case uuid,
  target_actor uuid default null
)
returns table(proposal_id uuid, proposal_version_id uuid, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal_id uuid;
  v_version_id uuid;
  v_created boolean := false;
begin
  if target_org is null or target_case is null then
    raise exception 'organization_and_case_required';
  end if;

  if not exists (
    select 1 from public.cases
    where id = target_case and organization_id = target_org
  ) then
    raise exception 'case_not_found';
  end if;

  select id, current_version_id
    into v_proposal_id, v_version_id
  from public.proposals
  where organization_id = target_org and case_id = target_case
  for update;

  if v_proposal_id is null then
    insert into public.proposals (organization_id, case_id, status)
    values (target_org, target_case, 'draft')
    on conflict (organization_id, case_id) do nothing
    returning id, current_version_id into v_proposal_id, v_version_id;

    if v_proposal_id is null then
      select id, current_version_id
        into v_proposal_id, v_version_id
      from public.proposals
      where organization_id = target_org and case_id = target_case
      for update;
    else
      v_created := true;
    end if;
  end if;

  if v_version_id is null then
    select id into v_version_id
    from public.proposal_versions
    where organization_id = target_org and proposal_id = v_proposal_id
    order by version_number desc
    limit 1;

    if v_version_id is null then
      insert into public.proposal_versions (
        organization_id,
        proposal_id,
        version_number,
        status,
        total_sale,
        total_cost,
        total_cost_budget,
        budgeted_profit
      ) values (
        target_org,
        v_proposal_id,
        1,
        'draft',
        0,
        0,
        0,
        0
      ) returning id into v_version_id;
    end if;

    update public.proposals
      set current_version_id = v_version_id,
          updated_at = now()
    where id = v_proposal_id and organization_id = target_org;
  end if;

  if v_created then
    update public.cases
      set status = 'budget_draft',
          next_action = 'Completar presupuesto',
          updated_at = now()
    where id = target_case and organization_id = target_org;

    insert into public.timeline_events (
      organization_id,
      case_id,
      event_type,
      title,
      payload,
      created_by
    ) values (
      target_org,
      target_case,
      'proposal.created',
      'Presupuesto creado',
      jsonb_build_object('proposal_id', v_proposal_id, 'proposal_version_id', v_version_id),
      target_actor
    );
  end if;

  return query select v_proposal_id, v_version_id, v_created;
end;
$$;

revoke all on function public.create_or_get_case_proposal(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_or_get_case_proposal(uuid, uuid, uuid) to service_role;

DROP POLICY IF EXISTS clients_org_access ON public.clients;
CREATE POLICY clients_select_scoped ON public.clients FOR SELECT TO authenticated USING (organization_id = (SELECT public.current_org_id()));
CREATE POLICY clients_insert_scoped ON public.clients FOR INSERT TO authenticated WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations']::public.app_role[]));
CREATE POLICY clients_update_scoped ON public.clients FOR UPDATE TO authenticated USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations']::public.app_role[])) WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations']::public.app_role[]));
CREATE POLICY clients_delete_scoped ON public.clients FOR DELETE TO authenticated USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction']::public.app_role[]));

DROP POLICY IF EXISTS leads_org_access ON public.leads;
CREATE POLICY leads_select_scoped ON public.leads FOR SELECT TO authenticated USING (organization_id = (SELECT public.current_org_id()));
CREATE POLICY leads_write_scoped ON public.leads FOR ALL TO authenticated USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations']::public.app_role[])) WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations']::public.app_role[]));

DROP POLICY IF EXISTS bookings_org_access ON public.bookings;
CREATE POLICY bookings_select_scoped ON public.bookings FOR SELECT TO authenticated USING (organization_id = (SELECT public.current_org_id()));
CREATE POLICY bookings_write_scoped ON public.bookings FOR ALL TO authenticated USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations']::public.app_role[])) WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations']::public.app_role[]));

DROP POLICY IF EXISTS cases_org_access ON public.cases;
CREATE POLICY cases_select_scoped ON public.cases FOR SELECT TO authenticated USING (organization_id = (SELECT public.current_org_id()));
CREATE POLICY cases_insert_scoped ON public.cases FOR INSERT TO authenticated WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations']::public.app_role[]));
CREATE POLICY cases_update_scoped ON public.cases FOR UPDATE TO authenticated USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations']::public.app_role[])) WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations']::public.app_role[]));
CREATE POLICY cases_delete_scoped ON public.cases FOR DELETE TO authenticated USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction']::public.app_role[]));

DROP POLICY IF EXISTS proposals_org_access ON public.proposals;
CREATE POLICY proposals_select_scoped ON public.proposals FOR SELECT TO authenticated USING (organization_id = (SELECT public.current_org_id()));
CREATE POLICY proposals_write_scoped ON public.proposals FOR ALL TO authenticated USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales']::public.app_role[])) WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales']::public.app_role[]));

DROP POLICY IF EXISTS proposal_versions_org_access ON public.proposal_versions;
CREATE POLICY proposal_versions_select_scoped ON public.proposal_versions FOR SELECT TO authenticated USING (organization_id = (SELECT public.current_org_id()));
CREATE POLICY proposal_versions_write_scoped ON public.proposal_versions FOR ALL TO authenticated USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales']::public.app_role[])) WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales']::public.app_role[]));

DROP POLICY IF EXISTS budget_lines_org_access ON public.budget_lines;
CREATE POLICY budget_lines_select_scoped ON public.budget_lines FOR SELECT TO authenticated USING (organization_id = (SELECT public.current_org_id()));
CREATE POLICY budget_lines_write_scoped ON public.budget_lines FOR ALL TO authenticated USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales']::public.app_role[])) WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales']::public.app_role[]));

DROP POLICY IF EXISTS expected_purchases_org_access ON public.expected_purchases;
CREATE POLICY expected_purchases_select_scoped ON public.expected_purchases FOR SELECT TO authenticated USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[]));
CREATE POLICY expected_purchases_write_scoped ON public.expected_purchases FOR ALL TO authenticated USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[])) WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[]));

DROP POLICY IF EXISTS supplier_invoices_org_access ON public.supplier_invoices;
CREATE POLICY supplier_invoices_select_scoped ON public.supplier_invoices FOR SELECT TO authenticated USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[]));
CREATE POLICY supplier_invoices_write_scoped ON public.supplier_invoices FOR ALL TO authenticated USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[])) WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[]));

DROP POLICY IF EXISTS contracts_org_access ON public.contracts;
CREATE POLICY contracts_select_scoped ON public.contracts FOR SELECT TO authenticated USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[]));
CREATE POLICY contracts_write_scoped ON public.contracts FOR ALL TO authenticated USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[])) WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[]));

DROP POLICY IF EXISTS payments_org_access ON public.payments;
CREATE POLICY payments_select_scoped ON public.payments FOR SELECT TO authenticated USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','billing']::public.app_role[]));
CREATE POLICY payments_write_scoped ON public.payments FOR ALL TO authenticated USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','billing']::public.app_role[])) WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','billing']::public.app_role[]));

DROP POLICY IF EXISTS payment_links_org_access ON public.payment_links;
CREATE POLICY payment_links_select_scoped ON public.payment_links FOR SELECT TO authenticated USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales']::public.app_role[]));
CREATE POLICY payment_links_write_scoped ON public.payment_links FOR ALL TO authenticated USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales']::public.app_role[])) WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales']::public.app_role[]));

DROP POLICY IF EXISTS billing_documents_org_access ON public.billing_documents;
CREATE POLICY billing_documents_select_scoped ON public.billing_documents FOR SELECT TO authenticated USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','billing']::public.app_role[]));
CREATE POLICY billing_documents_write_scoped ON public.billing_documents FOR ALL TO authenticated USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','billing']::public.app_role[])) WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','billing']::public.app_role[]));

DROP POLICY IF EXISTS travelers_org_access ON public.travelers;
CREATE POLICY travelers_select_scoped ON public.travelers FOR SELECT TO authenticated USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations']::public.app_role[]));
CREATE POLICY travelers_write_scoped ON public.travelers FOR ALL TO authenticated USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations']::public.app_role[])) WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations']::public.app_role[]));

DROP POLICY IF EXISTS tasks_org_access ON public.tasks;
CREATE POLICY tasks_select_scoped ON public.tasks FOR SELECT TO authenticated USING (organization_id = (SELECT public.current_org_id()));
CREATE POLICY tasks_write_scoped ON public.tasks FOR ALL TO authenticated USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[])) WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[]));

DROP POLICY IF EXISTS timeline_events_org_access ON public.timeline_events;
CREATE POLICY timeline_events_select_scoped ON public.timeline_events FOR SELECT TO authenticated USING (organization_id = (SELECT public.current_org_id()));
CREATE POLICY timeline_events_write_scoped ON public.timeline_events FOR ALL TO authenticated USING (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[])) WITH CHECK (organization_id = (SELECT public.current_org_id()) AND (SELECT public.current_app_role()) = ANY (ARRAY['admin','direction','sales','operations','billing']::public.app_role[]));

