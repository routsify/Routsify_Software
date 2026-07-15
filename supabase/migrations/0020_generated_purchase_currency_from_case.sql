-- Keep automatically generated purchases in the same currency as the case
-- whose budget line produced them. Historical rows are intentionally left
-- untouched; the trigger applies only to future inserts or relinking updates.

create or replace function public.sync_generated_purchase_currency_from_case()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  case_currency text;
begin
  if new.case_id is null or new.proposal_version_id is null or new.budget_line_id is null then
    return new;
  end if;

  select c.currency
  into case_currency
  from public.cases c
  where c.id = new.case_id
    and c.organization_id = new.organization_id
  limit 1;

  if nullif(btrim(case_currency), '') is not null then
    new.currency := upper(case_currency);
  end if;

  return new;
end;
$$;

drop trigger if exists expected_purchases_sync_case_currency on public.expected_purchases;
create trigger expected_purchases_sync_case_currency
before insert or update of case_id, proposal_version_id, budget_line_id
on public.expected_purchases
for each row
execute function public.sync_generated_purchase_currency_from_case();
