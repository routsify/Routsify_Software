create or replace function public.routsify_has_active_booking(target_org uuid,target_client uuid)
returns boolean language sql stable set search_path = public as $function$
  select exists (
    select 1 from public.bookings b
    where b.organization_id = target_org
      and b.client_id = target_client
      and lower(coalesce(b.status, '')) not in ('cancelled','canceled','cancelado','cancelada','rejected','deleted')
      and lower(coalesce(b.event_type, '')) not like '%cancel%'
  );
$function$;

create or replace function public.routsify_classify_fillout_lead_booking()
returns trigger language plpgsql set search_path = public as $function$
begin
  if lower(coalesce(new.source, '')) = 'fillout'
     and new.client_id is not null
     and new.status in ('form_received','form_received_call_pending','form_received_call_booked','call_booked_form_pending') then
    new.status := case when public.routsify_has_active_booking(new.organization_id, new.client_id)
      then 'form_received_call_booked' else 'form_received_call_pending' end;
  end if;
  return new;
end;
$function$;

drop trigger if exists leads_classify_fillout_booking on public.leads;
create trigger leads_classify_fillout_booking
before insert or update of status, client_id, source on public.leads
for each row execute function public.routsify_classify_fillout_lead_booking();

create or replace function public.routsify_sync_fillout_booking_alert()
returns trigger language plpgsql set search_path = public as $function$
declare task_key text;
begin
  if lower(coalesce(new.source, '')) <> 'fillout' or new.client_id is null then return new; end if;
  task_key := 'fillout_without_booking:' || new.id::text;
  if new.status = 'form_received_call_pending' then
    insert into public.tasks (organization_id,client_id,title,status,priority,due_at,idempotency_key,payload,updated_at)
    values (
      new.organization_id,new.client_id,'⚠ Formulario recibido sin llamada reservada','pending','urgent',now(),task_key,
      jsonb_build_object('action_type','fillout_without_booking','lead_id',new.id,'client_id',new.client_id,'recipient_email',new.email,'recipient_phone',new.phone,'destination',new.destination,'suggested_action','Contactar al cliente y enviarle el enlace para reservar la llamada.'),
      now()
    )
    on conflict (organization_id,idempotency_key) do update set
      client_id=excluded.client_id,title=excluded.title,status='pending',priority='urgent',due_at=now(),payload=excluded.payload,updated_at=now();
  elsif new.status = 'form_received_call_booked' then
    update public.tasks set status='done',payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('completed_by_event','booking_detected','completed_at',now()),updated_at=now()
    where organization_id=new.organization_id and idempotency_key=task_key and status in ('pending','in_progress');
  end if;
  return new;
end;
$function$;

drop trigger if exists leads_sync_fillout_booking_alert on public.leads;
create trigger leads_sync_fillout_booking_alert
after insert or update of status, client_id, source on public.leads
for each row execute function public.routsify_sync_fillout_booking_alert();

create or replace function public.routsify_recheck_fillout_after_booking()
returns trigger language plpgsql set search_path = public as $function$
begin
  if new.client_id is null then return new; end if;
  update public.leads set status='form_received',updated_at=now()
  where organization_id=new.organization_id and client_id=new.client_id and lower(coalesce(source,''))='fillout'
    and status in ('form_received','form_received_call_pending','form_received_call_booked','call_booked_form_pending');
  return new;
end;
$function$;

drop trigger if exists bookings_recheck_fillout_alert on public.bookings;
create trigger bookings_recheck_fillout_alert
after insert or update of status, event_type, client_id on public.bookings
for each row execute function public.routsify_recheck_fillout_after_booking();

