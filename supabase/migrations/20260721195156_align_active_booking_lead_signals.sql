-- Keep the explicit form/call signal columns aligned with a client's active
-- booking. A historical lead may be archived while its future appointment is
-- still valid; the newest pending form must own that operational signal.
create or replace function public.routsify_has_active_booking(target_org uuid, target_client uuid)
returns boolean
language sql
stable
set search_path = public
as $function$
  select exists (
    select 1
    from public.bookings b
    where b.organization_id = target_org
      and b.client_id = target_client
      and lower(coalesce(b.status, '')) not in (
        'cancelled', 'canceled', 'cancelado', 'cancelada', 'rejected', 'deleted'
      )
      and lower(coalesce(b.event_type, '')) not like '%cancel%'
      and coalesce(b.ends_at, b.starts_at, b.event_timestamp, b.created_at)
        >= now() - interval '2 hours'
  );
$function$;

create or replace function public.routsify_classify_fillout_lead_booking()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  matched_booking_id uuid;
  matched_call_at timestamptz;
begin
  if lower(coalesce(new.source, '')) = 'fillout'
     and new.client_id is not null
     and new.status in (
       'form_received',
       'form_received_call_pending',
       'form_received_call_booked',
       'call_booked_form_pending'
     ) then
    if new.call_booked_at is null then
      select
        b.id,
        coalesce(b.starts_at, b.event_timestamp, b.created_at)
      into matched_booking_id, matched_call_at
      from public.bookings b
      where b.organization_id = new.organization_id
        and b.client_id = new.client_id
        and lower(coalesce(b.status, '')) not in (
          'cancelled', 'canceled', 'cancelado', 'cancelada', 'rejected', 'deleted'
        )
        and lower(coalesce(b.event_type, '')) not like '%cancel%'
        and coalesce(b.ends_at, b.starts_at, b.event_timestamp, b.created_at)
          >= now() - interval '2 hours'
      order by
        case
          when coalesce(b.starts_at, b.event_timestamp, b.created_at) >= now() then 0
          else 1
        end,
        abs(extract(epoch from (
          coalesce(b.starts_at, b.event_timestamp, b.created_at) - now()
        )))
      limit 1;
    end if;

    if new.call_booked_at is not null or matched_booking_id is not null then
      new.booking_id := coalesce(new.booking_id, matched_booking_id);
      new.call_booked_at := coalesce(new.call_booked_at, matched_call_at);
      new.status := 'form_received_call_booked';
    else
      new.status := 'form_received_call_pending';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists leads_classify_fillout_booking on public.leads;
create trigger leads_classify_fillout_booking
before insert or update of status, client_id, source, call_booked_at, booking_id
on public.leads
for each row
execute function public.routsify_classify_fillout_lead_booking();

with pending_leads as (
  select distinct on (l.organization_id, l.client_id)
    l.id,
    l.organization_id,
    l.client_id
  from public.leads l
  where l.client_id is not null
    and lower(coalesce(l.source, '')) = 'fillout'
    and l.review_status = 'pending'
    and l.form_received_at is not null
    and l.call_booked_at is null
  order by l.organization_id, l.client_id, l.updated_at desc, l.created_at desc
), active_bookings as (
  select distinct on (b.organization_id, b.client_id)
    b.id,
    b.organization_id,
    b.client_id,
    coalesce(b.starts_at, b.event_timestamp, b.created_at) as call_booked_at
  from public.bookings b
  where b.client_id is not null
    and lower(coalesce(b.status, '')) not in (
      'cancelled', 'canceled', 'cancelado', 'cancelada', 'rejected', 'deleted'
    )
    and lower(coalesce(b.event_type, '')) not like '%cancel%'
    and coalesce(b.ends_at, b.starts_at, b.event_timestamp, b.created_at)
      >= now() - interval '2 hours'
  order by
    b.organization_id,
    b.client_id,
    case
      when coalesce(b.starts_at, b.event_timestamp, b.created_at) >= now() then 0
      else 1
    end,
    abs(extract(epoch from (
      coalesce(b.starts_at, b.event_timestamp, b.created_at) - now()
    )))
), matched as (
  select
    l.id as lead_id,
    b.id as booking_id,
    b.call_booked_at
  from pending_leads l
  join active_bookings b
    on b.organization_id = l.organization_id
   and b.client_id = l.client_id
)
update public.leads l
set
  booking_id = matched.booking_id,
  call_booked_at = matched.call_booked_at,
  status = 'form_received_call_booked',
  updated_at = now()
from matched
where l.id = matched.lead_id;

with preferred_leads as (
  select distinct on (l.organization_id, l.booking_id)
    l.id,
    l.organization_id,
    l.booking_id
  from public.leads l
  where l.booking_id is not null
    and l.review_status = 'pending'
    and l.form_received_at is not null
    and l.call_booked_at is not null
  order by l.organization_id, l.booking_id, l.updated_at desc, l.created_at desc
)
update public.bookings b
set
  lead_id = preferred_leads.id,
  updated_at = now()
from preferred_leads
where b.id = preferred_leads.booking_id
  and b.organization_id = preferred_leads.organization_id
  and b.lead_id is distinct from preferred_leads.id
  and not exists (
    select 1
    from public.leads current_lead
    where current_lead.id = b.lead_id
      and current_lead.review_status = 'pending'
  );
