create extension if not exists pgcrypto;

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel text not null,
  event_type text not null,
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received',
  error_message text,
  unique (organization_id, channel, event_type, idempotency_key)
);

alter table public.webhook_events enable row level security;

drop policy if exists webhook_events_select on public.webhook_events;
drop policy if exists webhook_events_insert on public.webhook_events;
drop policy if exists webhook_events_update on public.webhook_events;

create policy webhook_events_select on public.webhook_events for select using (public.has_org_access(organization_id));
create policy webhook_events_insert on public.webhook_events for insert with check (public.has_org_access(organization_id) and public.has_role(array['admin','direction','operations','billing','sales']));
create policy webhook_events_update on public.webhook_events for update using (public.has_org_access(organization_id) and public.has_role(array['admin','direction','operations','billing'])) with check (public.has_org_access(organization_id));

drop trigger if exists webhook_events_audit on public.webhook_events;
create trigger webhook_events_audit after insert or update or delete on public.webhook_events for each row execute function public.audit_row_change();

create or replace function public.enqueue_integration_event(
  target_org uuid,
  channel_name text,
  event_name text,
  idem_key text,
  event_payload jsonb,
  event_risk text default 'low',
  rule text default null,
  action text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  outbox_id uuid;
begin
  insert into public.integration_outbox(organization_id, channel, event_type, status, attempts, max_attempts, risk, idempotency_key, payload, business_rule, next_action)
  values (
    target_org,
    channel_name,
    event_name,
    case when event_risk = 'high' then 'manual_review' else 'pending' end,
    0,
    case when event_risk = 'high' then 2 else 3 end,
    event_risk,
    idem_key,
    coalesce(event_payload, '{}'::jsonb),
    rule,
    action
  )
  on conflict (organization_id, channel, event_type, idempotency_key) do update
    set payload = excluded.payload,
        business_rule = coalesce(excluded.business_rule, public.integration_outbox.business_rule),
        next_action = coalesce(excluded.next_action, public.integration_outbox.next_action)
  returning id into outbox_id;

  return outbox_id;
end;
$$;

create or replace function public.confirm_manual_payment(
  target_case uuid,
  amount_value numeric,
  payment_reference text,
  received_timestamp timestamptz default now()
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  case_org uuid;
  payment_id uuid;
begin
  select organization_id into case_org from public.cases where id = target_case;
  if case_org is null then
    raise exception 'case_not_found';
  end if;

  insert into public.payments(organization_id, case_id, method, amount, status, received_at, reference, idempotency_key)
  values (case_org, target_case, 'transferencia_manual', amount_value, 'received', received_timestamp, payment_reference, payment_reference)
  on conflict (organization_id, idempotency_key) do update
    set status = 'received', received_at = excluded.received_at, amount = excluded.amount
  returning id into payment_id;

  perform public.enqueue_integration_event(
    case_org,
    'payment',
    'payment.manual_confirmed',
    coalesce(payment_reference, payment_id::text),
    jsonb_build_object('payment_id', payment_id, 'case_id', target_case, 'amount', amount_value),
    'medium',
    'Pago confirmado manualmente antes de desbloquear fiscalidad o cierre.',
    'Revisar documento fiscal y cierre operativo.'
  );

  return payment_id;
end;
$$;

create or replace function public.ready_billing_documents_for_review(target_org uuid)
returns table(document_id uuid, case_id uuid, amount numeric, status text, sync_message text)
language sql security definer set search_path = public as $$
  select bd.id, bd.case_id, bd.amount, bd.status, bd.sync_message
  from public.billing_documents bd
  where bd.organization_id = target_org
    and bd.status in ('ready','sent','blocked','error')
  order by bd.created_at desc;
$$;
