create or replace function public.routsify_sync_fillout_booking_alert()
returns trigger language plpgsql set search_path = public as $function$
declare
  open_task_id uuid;
  task_key text;
  alert_cycle integer;
begin
  if lower(coalesce(new.source, '')) <> 'fillout' or new.client_id is null then return new; end if;

  if new.status = 'form_received_call_pending' then
    select t.id into open_task_id
    from public.tasks t
    where t.organization_id = new.organization_id
      and t.status in ('pending','in_progress')
      and t.payload ->> 'action_type' = 'fillout_without_booking'
      and t.payload ->> 'lead_id' = new.id::text
    order by t.created_at desc limit 1;

    if open_task_id is not null then
      update public.tasks
      set client_id=new.client_id,
          title='⚠ Formulario recibido sin llamada reservada',
          priority='urgent',
          due_at=now(),
          payload=jsonb_build_object('action_type','fillout_without_booking','lead_id',new.id,'client_id',new.client_id,'recipient_email',new.email,'recipient_phone',new.phone,'destination',new.destination,'suggested_action','Contactar al cliente y enviarle el enlace para reservar la llamada.'),
          updated_at=now()
      where id=open_task_id;
    else
      select count(*)+1 into alert_cycle
      from public.tasks t
      where t.organization_id=new.organization_id
        and t.payload ->> 'action_type'='fillout_without_booking'
        and t.payload ->> 'lead_id'=new.id::text;

      task_key := 'fillout_without_booking:' || new.id::text || ':cycle:' || alert_cycle::text;
      insert into public.tasks (organization_id,client_id,title,status,priority,due_at,idempotency_key,payload,updated_at)
      values (new.organization_id,new.client_id,'⚠ Formulario recibido sin llamada reservada','pending','urgent',now(),task_key,
        jsonb_build_object('action_type','fillout_without_booking','lead_id',new.id,'client_id',new.client_id,'recipient_email',new.email,'recipient_phone',new.phone,'destination',new.destination,'suggested_action','Contactar al cliente y enviarle el enlace para reservar la llamada.','alert_cycle',alert_cycle),now())
      on conflict (organization_id,idempotency_key) do nothing;
    end if;
  elsif new.status='form_received_call_booked' then
    update public.tasks
    set status='done',payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('completed_by_event','booking_detected','completed_at',now()),updated_at=now()
    where organization_id=new.organization_id
      and status in ('pending','in_progress')
      and payload ->> 'action_type'='fillout_without_booking'
      and payload ->> 'lead_id'=new.id::text;
  end if;
  return new;
end;
$function$;

