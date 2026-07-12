-- Operational close preflight: trip + five days, signed contract, full payment, resolved supplier purchases and final invoice.
create or replace function public.operational_close_preflight(target_case uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.cases%rowtype; delay_days integer:=5; blockers jsonb:='[]'::jsonb; pending integer:=0; errors integer:=0; paid numeric:=0; ready boolean:=false;
begin
  select * into c from public.cases where id=target_case for update;
  if not found then raise exception 'case_not_found'; end if;
  select coalesce(close_margin_days,5) into delay_days from public.organizations where id=c.organization_id;
  if c.trip_end is null or c.trip_end+delay_days>current_date then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','trip_wait_period')); end if;
  if not exists(select 1 from public.proposals p join public.proposal_versions v on v.id=p.current_version_id where p.organization_id=c.organization_id and p.case_id=c.id and p.status='accepted' and v.locked=true) then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','accepted_budget_missing')); end if;
  if not exists(select 1 from public.contracts where organization_id=c.organization_id and case_id=c.id and status='signed') then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','contract_not_signed')); end if;
  select coalesce(sum(amount),0) into paid from public.payments where organization_id=c.organization_id and case_id=c.id and status='confirmed';
  if paid<coalesce(c.accepted_value,0) then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','payment_incomplete','confirmed',paid,'required',coalesce(c.accepted_value,0))); end if;
  select count(*) into pending from public.expected_purchases where organization_id=c.organization_id and case_id=c.id and coalesce(active,true) and coalesce(required,true) and status not in('approved','not_required','cancelled');
  if pending>0 then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','supplier_purchases_pending','count',pending)); end if;
  select count(*) into errors from public.integration_outbox where organization_id=c.organization_id and related_case_id=c.id and status in('failed','manual_review');
  if errors>0 then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','integration_errors','count',errors)); end if;
  if not exists(select 1 from public.billing_documents where organization_id=c.organization_id and case_id=c.id and coalesce(document_type,type)='final_invoice' and sync_status='synced' and status in('issued','synced','paid')) then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','final_invoice_missing')); end if;
  ready:=jsonb_array_length(blockers)=0;
  update public.cases set closure_check_at=now(),close_blockers=blockers,next_action=case when ready then 'Cerrar expediente' else next_action end,blocker=case when ready then null else 'Preflight de cierre con bloqueos pendientes' end,updated_at=now() where id=c.id;
  return jsonb_build_object('ready',ready,'case_id',c.id,'blockers',blockers,'pending_purchases',pending,'integration_errors',errors,'confirmed_payments',paid);
end;$$;
revoke all on function public.operational_close_preflight(uuid) from public,anon,authenticated;
grant execute on function public.operational_close_preflight(uuid) to service_role;
