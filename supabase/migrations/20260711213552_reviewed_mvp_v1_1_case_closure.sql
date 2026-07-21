create table if not exists public.case_stage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  from_status text,
  to_status text not null,
  entered_at timestamptz not null default now(),
  changed_by uuid,
  source text not null default 'application',
  metadata jsonb not null default '{}'::jsonb
);

create or replace function public.track_case_status_change()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.last_activity_at:=now();
  new.last_event_at:=now();
  if old.status is distinct from new.status then
    insert into public.case_stage_events(organization_id,case_id,from_status,to_status,changed_by,metadata)
    values(new.organization_id,new.id,old.status::text,new.status::text,null,jsonb_build_object('next_action',new.next_action,'blocker',new.blocker));
    insert into public.timeline_events(organization_id,case_id,client_id,event_type,title,payload)
    values(new.organization_id,new.id,new.client_id,'case.status_changed','Estado del expediente actualizado',jsonb_build_object('from',old.status,'to',new.status,'next_action',new.next_action,'blocker',new.blocker));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_track_case_status_change on public.cases;
create trigger trg_track_case_status_change
before update on public.cases
for each row execute function public.track_case_status_change();

create or replace function public.operational_close_preflight(target_case uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_case public.cases%rowtype;
  v_org public.organizations%rowtype;
  blockers jsonb:='[]'::jsonb;
  pending_purchases integer:=0;
  integration_errors integer:=0;
  payment_total numeric:=0;
  ready boolean:=false;
  earliest_close date;
begin
  select * into v_case from public.cases where id=target_case for update;
  if not found then raise exception 'case_not_found'; end if;
  select * into v_org from public.organizations where id=v_case.organization_id;
  earliest_close:=case when v_case.trip_end is null then null else v_case.trip_end+coalesce(v_org.close_margin_days,5) end;

  if v_case.trip_end is null then
    blockers:=blockers||jsonb_build_array(jsonb_build_object('code','trip_end_missing','message','Falta la fecha de fin del viaje.'));
  elsif current_date<earliest_close then
    blockers:=blockers||jsonb_build_array(jsonb_build_object('code','close_margin_not_reached','message','Aún no se ha alcanzado la fecha de control post-viaje.','earliest_close',earliest_close));
  end if;
  if not exists(select 1 from public.proposals p join public.proposal_versions pv on pv.id=p.current_version_id where p.case_id=target_case and p.organization_id=v_case.organization_id and p.status='accepted' and pv.locked=true) then
    blockers:=blockers||jsonb_build_array(jsonb_build_object('code','accepted_budget_missing','message','No existe una versión aceptada y bloqueada.'));
  end if;
  if not exists(select 1 from public.contracts where organization_id=v_case.organization_id and case_id=target_case and status='signed') then
    blockers:=blockers||jsonb_build_array(jsonb_build_object('code','contract_not_signed','message','El contrato no está firmado.'));
  end if;
  select coalesce(sum(amount),0) into payment_total from public.payments where organization_id=v_case.organization_id and case_id=target_case and status='confirmed';
  if payment_total<coalesce(v_case.accepted_value,0) then
    blockers:=blockers||jsonb_build_array(jsonb_build_object('code','payment_incomplete','message','El pago confirmado no cubre la venta aceptada.','confirmed',payment_total,'required',coalesce(v_case.accepted_value,0)));
  end if;
  if coalesce(v_case.fiscal_resolution_status,'pending') not in ('resolved','not_required','manual_review_completed') then
    blockers:=blockers||jsonb_build_array(jsonb_build_object('code','fiscal_mode_unresolved','message','El modo fiscal aún no está resuelto.'));
  end if;
  select count(*) into pending_purchases from public.expected_purchases where case_id=target_case and organization_id=v_case.organization_id and active=true and required=true and status not in ('approved','not_required','cancelled');
  if pending_purchases>0 then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','supplier_purchases_pending','message','Hay compras o facturas de proveedor pendientes.','count',pending_purchases)); end if;
  select count(*) into integration_errors from public.integration_outbox where related_case_id=target_case and organization_id=v_case.organization_id and status in ('failed','manual_review');
  if integration_errors>0 then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','integration_errors','message','Hay errores o revisiones de integración pendientes.','count',integration_errors)); end if;
  if exists(select 1 from public.billing_documents where case_id=target_case and organization_id=v_case.organization_id and trigger='final_after_trip' and status in ('issued','synced')) then
    blockers:=blockers||jsonb_build_array(jsonb_build_object('code','duplicate_final_document','message','Ya existe un documento final para este expediente.'));
  end if;

  ready:=jsonb_array_length(blockers)=0;
  update public.cases
  set closure_check_at=now(),close_blockers=blockers,
      status=case when ready and status<>'closed' then 'ready_to_close'::public.case_status else case when not ready and pending_purchases>0 then 'suppliers_pending'::public.case_status else status end end,
      next_action=case when ready then 'Revisar y cerrar expediente' when pending_purchases>0 then 'Reclamar o conciliar facturas de proveedor' else next_action end,
      blocker=case when ready then null else coalesce((blockers->0->>'message'),'Preflight de cierre con bloqueos pendientes') end,
      purchase_status=case when pending_purchases=0 then 'resolved' else 'pending' end,
      updated_at=now()
  where id=target_case;

  return jsonb_build_object('ready',ready,'case_id',target_case,'blockers',blockers,'earliest_close',earliest_close,'pending_purchases',pending_purchases,'integration_errors',integration_errors,'confirmed_payments',payment_total);
end;
$$;

create or replace function public.close_operational_case(target_case uuid, actor uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_preflight jsonb; v_case public.cases%rowtype; v_now timestamptz:=now();
begin
  v_preflight:=public.operational_close_preflight(target_case);
  if coalesce((v_preflight->>'ready')::boolean,false)=false then raise exception 'case_close_blocked'; end if;
  update public.cases set status='closed'::public.case_status,closed_at=v_now,operational_closed_at=v_now,next_action='Expediente cerrado',blocker=null,updated_at=v_now where id=target_case returning * into v_case;
  insert into public.timeline_events(organization_id,case_id,event_type,title,payload,created_by) values(v_case.organization_id,target_case,'case.closed','Expediente cerrado',v_preflight,actor);
  insert into public.audit_log(organization_id,actor_id,entity_type,entity_id,action,after_data) values(v_case.organization_id,actor,'case',target_case,'closed',to_jsonb(v_case));
  return jsonb_build_object('case',to_jsonb(v_case),'preflight',v_preflight);
end;
$$;

