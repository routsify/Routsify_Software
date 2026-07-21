-- Track the two independent intake signals (form and call) on one lead.
-- Nullable columns keep existing integrations backwards compatible while the
-- worker progressively backfills and merges new events.
alter table public.leads
  add column if not exists form_submission_id text,
  add column if not exists form_received_at timestamptz,
  add column if not exists call_booked_at timestamptz,
  add column if not exists booking_id uuid references public.bookings(id) on delete set null,
  add column if not exists form_reminder_sent_at timestamptz,
  add column if not exists booking_invite_sent_at timestamptz;

-- Existing Fillout rows are already idempotent by source_submission_id. Copy
-- that provider identifier into the new cross-channel merge key.
update public.leads
set
  form_submission_id = coalesce(form_submission_id, source_submission_id),
  form_received_at = coalesce(
    form_received_at,
    case
      when coalesce(payload_redacted ->> 'submitted_at', '') ~ '^\d{4}-\d{2}-\d{2}T'
        then (payload_redacted ->> 'submitted_at')::timestamptz
      else created_at
    end
  )
where source = 'fillout'
  and source_submission_id is not null;

-- Fillout can contain a native scheduling block. Treat it as a real call
-- signal even when the separate booking webhook was never configured.
update public.leads
set call_booked_at = coalesce(
  call_booked_at,
  case
    when coalesce(payload_redacted ->> 'scheduling_start', '') ~ '^\d{4}-\d{2}-\d{2}T'
      then (payload_redacted ->> 'scheduling_start')::timestamptz
    else null
  end
)
where source = 'fillout'
  and payload_redacted ? 'scheduling_start';

-- Link historical booking events to their lead without touching cancelled
-- appointments. DISTINCT ON keeps the most recent active booking per lead.
with latest_booking as (
  select distinct on (b.lead_id)
    b.lead_id,
    b.id as booking_id,
    coalesce(b.starts_at, b.created_at) as call_booked_at
  from public.bookings b
  where b.lead_id is not null
    and lower(coalesce(b.status, '')) not in ('cancelled', 'canceled')
  order by b.lead_id, coalesce(b.starts_at, b.created_at) desc
)
update public.leads l
set
  booking_id = coalesce(l.booking_id, latest_booking.booking_id),
  call_booked_at = coalesce(l.call_booked_at, latest_booking.call_booked_at)
from latest_booking
where l.id = latest_booking.lead_id;

-- Normalize only active intake rows. Historical/won/lost records retain their
-- reviewed lifecycle exactly as it was.
update public.leads
set status = case
  when form_received_at is not null and call_booked_at is not null then 'form_received_call_booked'
  when form_received_at is not null then 'form_received_call_pending'
  when call_booked_at is not null then 'call_booked_form_pending'
  else status
end
where review_status = 'pending'
  and archived_at is null;

create unique index if not exists leads_form_submission_unique_idx
  on public.leads (organization_id, form_submission_id)
  where form_submission_id is not null;

create index if not exists leads_intake_queue_idx
  on public.leads (
    organization_id,
    review_status,
    form_received_at,
    call_booked_at,
    updated_at desc
  )
  where archived_at is null;

create index if not exists leads_booking_id_idx
  on public.leads (booking_id)
  where booking_id is not null;
