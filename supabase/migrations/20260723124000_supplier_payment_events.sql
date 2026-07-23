-- Supplier payments are independent from supplier invoices.
-- A payment represents real cash outflow; an invoice represents fiscal evidence.

alter table public.expected_purchases
  add column if not exists payment_reference text;

create table if not exists public.supplier_payment_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid null references public.suppliers(id) on delete set null,
  case_id uuid null references public.cases(id) on delete set null,
  holded_payment_id text null,
  holded_contact_id text null,
  amount numeric not null default 0,
  currency text not null default 'EUR',
  paid_at timestamptz not null,
  description text null,
  bank_id text null,
  payment_reference text null,
  source text not null default 'manual',
  status text not null default 'unassigned',
  match_score numeric null,
  source_payload_hash text null,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_payment_events_amount_check check (amount >= 0),
  constraint supplier_payment_events_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint supplier_payment_events_source_check check (source in ('holded','manual','bank_import','adjustment')),
  constraint supplier_payment_events_status_check check (status in ('unassigned','candidate','matched','review_needed','reversed','ignored')),
  constraint supplier_payment_events_match_score_check check (match_score is null or (match_score >= 0 and match_score <= 100))
);

create unique index if not exists supplier_payment_events_holded_payment_once_idx
  on public.supplier_payment_events(organization_id, holded_payment_id)
  where holded_payment_id is not null and holded_payment_id <> '';

create unique index if not exists supplier_payment_events_payload_hash_once_idx
  on public.supplier_payment_events(organization_id, source_payload_hash)
  where source_payload_hash is not null and source_payload_hash <> '';

create index if not exists supplier_payment_events_case_paid_at_idx
  on public.supplier_payment_events(organization_id, case_id, paid_at desc);

create index if not exists supplier_payment_events_supplier_paid_at_idx
  on public.supplier_payment_events(organization_id, supplier_id, paid_at desc);

create index if not exists supplier_payment_events_status_idx
  on public.supplier_payment_events(organization_id, status, paid_at desc);

create table if not exists public.supplier_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_payment_event_id uuid not null references public.supplier_payment_events(id) on delete cascade,
  expected_purchase_id uuid not null references public.expected_purchases(id) on delete cascade,
  allocated_amount numeric not null default 0,
  currency text not null default 'EUR',
  allocation_source text not null default 'manual',
  match_score numeric null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_payment_allocations_amount_check check (allocated_amount >= 0),
  constraint supplier_payment_allocations_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint supplier_payment_allocations_source_check check (allocation_source in ('reference','auto','manual','import')),
  constraint supplier_payment_allocations_match_score_check check (match_score is null or (match_score >= 0 and match_score <= 100))
);

create unique index if not exists supplier_payment_allocations_once_idx
  on public.supplier_payment_allocations(organization_id, supplier_payment_event_id, expected_purchase_id);

create index if not exists supplier_payment_allocations_purchase_idx
  on public.supplier_payment_allocations(organization_id, expected_purchase_id);

create index if not exists supplier_payment_allocations_event_idx
  on public.supplier_payment_allocations(organization_id, supplier_payment_event_id);

create unique index if not exists expected_purchases_payment_reference_once_idx
  on public.expected_purchases(organization_id, payment_reference)
  where payment_reference is not null and payment_reference <> '';

create or replace function public.build_expected_purchase_payment_reference(
  target_org uuid,
  target_case uuid,
  target_budget_line uuid,
  target_service text,
  target_sequence integer
)
returns text
language plpgsql
stable
set search_path=public
as $$
declare
  v_case_code text;
  v_case_fragment text;
  v_service text;
  v_service_code text;
begin
  select case_code into v_case_code
  from public.cases
  where id = target_case and organization_id = target_org;

  v_case_fragment := upper(regexp_replace(coalesce(v_case_code, 'EXP'), '^EXP-', '', 'i'));
  v_case_fragment := upper(regexp_replace(v_case_fragment, '[^a-zA-Z0-9]+', '-', 'g'));
  v_case_fragment := trim(both '-' from v_case_fragment);
  if v_case_fragment = '' then
    v_case_fragment := 'EXP';
  end if;

  select coalesce(service_type_code, description_public, supplier_name) into v_service
  from public.budget_lines
  where id = target_budget_line and organization_id = target_org;

  v_service := coalesce(nullif(v_service, ''), nullif(target_service, ''), 'SERV');
  v_service_code := upper(regexp_replace(v_service, '[^a-zA-Z0-9]+', '', 'g'));
  if v_service_code = '' then
    v_service_code := 'SERV';
  end if;

  return 'R-' || right(v_case_fragment, 8) || '-' || left(v_service_code, 6) || '-' || lpad(greatest(coalesce(target_sequence, 1), 1)::text, 2, '0');
end;
$$;

create or replace function public.set_expected_purchase_payment_reference()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_sequence integer;
begin
  if nullif(new.payment_reference, '') is not null then
    new.payment_reference := upper(regexp_replace(new.payment_reference, '\s+', '-', 'g'));
    return new;
  end if;

  if new.case_id is null then
    return new;
  end if;

  select count(*) + 1 into v_sequence
  from public.expected_purchases
  where organization_id = new.organization_id
    and case_id = new.case_id
    and id <> coalesce(new.id, gen_random_uuid());

  new.payment_reference := public.build_expected_purchase_payment_reference(
    new.organization_id,
    new.case_id,
    new.budget_line_id,
    new.service,
    v_sequence
  );
  return new;
end;
$$;

drop trigger if exists expected_purchases_set_payment_reference on public.expected_purchases;
create trigger expected_purchases_set_payment_reference
before insert or update of case_id, budget_line_id, service, payment_reference
on public.expected_purchases
for each row
execute function public.set_expected_purchase_payment_reference();

with ranked as (
  select
    ep.id,
    public.build_expected_purchase_payment_reference(
      ep.organization_id,
      ep.case_id,
      ep.budget_line_id,
      ep.service,
      row_number() over (partition by ep.organization_id, ep.case_id order by ep.created_at, ep.id)::integer
    ) as reference
  from public.expected_purchases ep
  where nullif(ep.payment_reference, '') is null
    and ep.case_id is not null
)
update public.expected_purchases ep
set payment_reference = ranked.reference,
    updated_at = now()
from ranked
where ep.id = ranked.id;

alter table public.supplier_payment_events enable row level security;
alter table public.supplier_payment_allocations enable row level security;

grant all on public.supplier_payment_events to service_role;
grant all on public.supplier_payment_allocations to service_role;

revoke all on function public.build_expected_purchase_payment_reference(uuid, uuid, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.set_expected_purchase_payment_reference() from public, anon, authenticated;
grant execute on function public.build_expected_purchase_payment_reference(uuid, uuid, uuid, text, integer) to service_role;
grant execute on function public.set_expected_purchase_payment_reference() to service_role;
