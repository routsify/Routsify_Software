create or replace function public.skip_historical_fillout_review_task()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  v_lead_id uuid;
  v_sync_mode text;
begin
  if coalesce(new.payload->>'action_type','') <> 'review_fillout' then
    return new;
  end if;

  if coalesce(new.payload->>'lead_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return new;
  end if;

  v_lead_id := (new.payload->>'lead_id')::uuid;

  select coalesce(l.payload_redacted->>'sync_mode','')
    into v_sync_mode
  from public.leads as l
  where l.id = v_lead_id
    and l.organization_id = new.organization_id;

  if v_sync_mode = 'full_import' then
    return null;
  end if;

  return new;
end;
$function$;

drop trigger if exists tasks_skip_historical_fillout_review on public.tasks;
create trigger tasks_skip_historical_fillout_review
before insert on public.tasks
for each row execute function public.skip_historical_fillout_review_task();

