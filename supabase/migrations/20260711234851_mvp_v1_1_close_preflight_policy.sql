create or replace function public.operational_close_preflight(target_case uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_case public.cases%rowtype; v_org public.organizations%rowtype; blockers jsonb:='[]'::jsonb; pending_purchases integer:=0; integration_errors integer:=0; payment_total numeric:=0; ready boolean:=false; earliest_close date;
begin
  select * into v_case from public.cases where id=target_case for update;
  if not found then raise exception 'case_not_found'; end if;
  select * into v_org from public.organizations where id=v_case.organization_id;
  earliest_close:=v_case.trip_end+coalesce(v_org.close_margin_days,5);
  if v_case.trip_end is null then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','trip_end_missing','message','Falta la fecha de fin del viaje.'));
  elsif current_date<earliest_close then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','close_delay_not_reached','message','Todavía no se ha alcanzado el margen operativo tras el viaje.','available_at',earliest_close)); end if;
  if not exists(select 1 from public.proposals p join public.proposal_versions pv on pv.id=p.current_version_id where p.case_id=target_case and p.organization_id=v_case.organization_id and p.status='accepted' and pv.locked=true) then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','accepted_budget_missing','message','No existe una versión aceptada y bloqueada.')); end if;
  if not exists(select 1 from public.contracts where organization_id=v_case.organization_id and case_id=target_case and status='signed') then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','contract_not_signed','message','El contrato no está firmado.')); end if;
  select coalesce(sum(amount),0) into payment_total from public.payments where organization_id=v_case.organization_id and case_id=target_case and status='confirmed';
  if payment_total<coalesce(v_case.accepted_value,0) then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','payment_incomplete','message','El pago confirmado no cubre la venta aceptada.','confirmed',payment_total,'required',coalesce(v_case.accepted_value,0))); end if;
  select count(*) into pending_purchases from public.expected_purchases where case_id=target_case and organization_id=v_case.organization_id and active=true and required=true and status not in ('approved','not_required','cancelled');
  if pending_purchases>0 then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','supplier_purchases_pending','message','Hay compras o facturas de proveedor pendientes.','count',pending_purchases)); end if;
  select count(*) into integration_errors from public.integration_outbox where related_case_id=target_case and organization_id=v_case.organization_id and status in ('failed','manual_review');
  if integration_errors>0 then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','integration_errors','message','Hay errores o revisiones de integración pendientes.','count',integration_errors)); end if;
  ready:=jsonb_array_length(blockers)=0;
  update public.cases set closure_check_at=now(),close_blockers=blockers,status=case when ready and status<>'closed' then 'ready_to_close'::public.case_status else status end,next_action=case when ready then 'Emitir factura final y cerrar expediente' else next_action end,blocker=case when ready then null else 'Preflight de cierre con bloqueos pendientes' end,updated_at=now() where id=target_case;
  return jsonb_build_object('ready',ready,'case_id',target_case,'blockers',blockers,'pending_purchases',pending_purchases,'integration_errors',integration_errors,'confirmed_payments',payment_total,'earliest_close',earliest_close);
end $$;
revoke all on function public.operational_close_preflight(uuid) from public,anon,authenticated;
grant execute on function public.operational_close_preflight(uuid) to service_role;

