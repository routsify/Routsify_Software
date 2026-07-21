create or replace function public.close_operational_case(target_case uuid,actor uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare preflight jsonb; v_case public.cases%rowtype;
begin
  preflight:=public.operational_close_preflight(target_case);
  if not coalesce((preflight->>'ready')::boolean,false) then raise exception 'case_close_preflight_failed'; end if;
  select * into v_case from public.cases where id=target_case for update;
  if v_case.billing_status<>'final_invoice_issued' then raise exception 'final_invoice_not_issued'; end if;
  update public.cases set status='closed',closed_at=now(),operational_closed_at=now(),next_action='Expediente cerrado',blocker=null,updated_at=now() where id=target_case;
  insert into public.audit_log(organization_id,actor_id,entity_type,entity_id,action,after_data) values(v_case.organization_id,actor,'case',target_case,'case.operationally_closed',jsonb_build_object('preflight',preflight));
  return jsonb_build_object('closed',true,'case_id',target_case);
end $$;
revoke all on function public.close_operational_case(uuid,uuid) from public,anon,authenticated;
grant execute on function public.close_operational_case(uuid,uuid) to service_role;

