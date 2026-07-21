create or replace function public.sync_case_purchase_status_from_expected_purchases()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_case_id uuid;
  target_organization_id uuid;
  has_required_purchases boolean := false;
  has_pending_purchases boolean := false;
  next_purchase_status text;
begin
  if tg_op = 'DELETE' then
    target_case_id := old.case_id;
    target_organization_id := old.organization_id;
  else
    target_case_id := new.case_id;
    target_organization_id := new.organization_id;
  end if;

  select
    exists(
      select 1
      from public.expected_purchases purchase
      where purchase.case_id = target_case_id
        and purchase.organization_id = target_organization_id
        and purchase.active = true
        and purchase.required = true
    ),
    exists(
      select 1
      from public.expected_purchases purchase
      where purchase.case_id = target_case_id
        and purchase.organization_id = target_organization_id
        and purchase.active = true
        and purchase.required = true
        and purchase.status not in ('approved', 'not_required', 'cancelled')
    )
  into has_required_purchases, has_pending_purchases;

  next_purchase_status := case
    when has_required_purchases and not has_pending_purchases then 'resolved'
    else 'pending'
  end;

  update public.cases
  set purchase_status = next_purchase_status,
      updated_at = now()
  where id = target_case_id
    and organization_id = target_organization_id
    and purchase_status is distinct from next_purchase_status;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists expected_purchases_sync_case_status on public.expected_purchases;
create trigger expected_purchases_sync_case_status
after insert or update or delete
on public.expected_purchases
for each row execute function public.sync_case_purchase_status_from_expected_purchases();

with derived_statuses as (
  select
    case_row.id,
    case_row.organization_id,
    case
      when exists(
        select 1
        from public.expected_purchases purchase
        where purchase.case_id = case_row.id
          and purchase.organization_id = case_row.organization_id
          and purchase.active = true
          and purchase.required = true
      )
      and not exists(
        select 1
        from public.expected_purchases purchase
        where purchase.case_id = case_row.id
          and purchase.organization_id = case_row.organization_id
          and purchase.active = true
          and purchase.required = true
          and purchase.status not in ('approved', 'not_required', 'cancelled')
      )
      then 'resolved'
      else 'pending'
    end as purchase_status
  from public.cases case_row
)
update public.cases case_row
set purchase_status = derived.purchase_status,
    updated_at = now()
from derived_statuses derived
where case_row.id = derived.id
  and case_row.organization_id = derived.organization_id
  and case_row.purchase_status is distinct from derived.purchase_status;

revoke all on function public.sync_case_purchase_status_from_expected_purchases() from public, anon, authenticated;
