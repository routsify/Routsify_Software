create or replace function public.enqueue_integration_event(
  target_org uuid,
  channel_name text,
  event_name text,
  idem_key text,
  event_payload jsonb,
  event_risk text default 'low'::text,
  rule text default null::text,
  action text default null::text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  result_id uuid;
  v_related_case_id uuid;
begin
  if target_org is null
     or nullif(channel_name,'') is null
     or nullif(event_name,'') is null
     or nullif(idem_key,'') is null then
    raise exception 'invalid_integration_event';
  end if;

  if coalesce(event_payload->>'case_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_related_case_id := (event_payload->>'case_id')::uuid;
  end if;

  insert into public.integration_outbox(
    organization_id,
    provider,
    channel,
    event_type,
    entity_type,
    related_case_id,
    idempotency_key,
    payload,
    sync_status,
    status,
    risk,
    business_rule,
    next_action,
    next_attempt_at
  ) values (
    target_org,
    channel_name,
    channel_name,
    event_name,
    'integration_event',
    v_related_case_id,
    idem_key,
    coalesce(event_payload,'{}'::jsonb),
    'pending'::public.sync_status,
    'pending',
    coalesce(event_risk,'low'),
    rule,
    action,
    now()
  )
  on conflict (organization_id,channel,event_type,idempotency_key)
  do update set
    payload = excluded.payload,
    related_case_id = coalesce(excluded.related_case_id, public.integration_outbox.related_case_id),
    risk = excluded.risk,
    business_rule = coalesce(excluded.business_rule,public.integration_outbox.business_rule),
    next_action = coalesce(excluded.next_action,public.integration_outbox.next_action),
    next_attempt_at = case
      when public.integration_outbox.status in ('done','manual_review') then public.integration_outbox.next_attempt_at
      else now()
    end
  returning id into result_id;

  return result_id;
end;
$function$;

