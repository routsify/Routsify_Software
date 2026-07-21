create unique index if not exists proposals_one_per_case_idx on public.proposals (organization_id, case_id);

alter table public.cases drop constraint if exists cases_trip_date_order;
alter table public.cases add constraint cases_trip_date_order check (trip_start is null or trip_end is null or trip_start <= trip_end);

create or replace function public.recalculate_proposal_version_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_version uuid;
  total_cost_value numeric;
  total_sale_value numeric;
begin
  target_version := coalesce(new.proposal_version_id, old.proposal_version_id);
  select coalesce(sum(cost_budget), 0), coalesce(sum(sale_price), 0)
    into total_cost_value, total_sale_value
  from public.budget_lines
  where proposal_version_id = target_version;

  update public.proposal_versions
  set total_cost_budget = total_cost_value,
      total_cost = total_cost_value,
      total_sale = total_sale_value,
      budgeted_profit = total_sale_value - total_cost_value
  where id = target_version;
  return coalesce(new, old);
end;
$$;

drop trigger if exists budget_lines_recalculate_totals on public.budget_lines;
create trigger budget_lines_recalculate_totals
after insert or update or delete on public.budget_lines
for each row execute function public.recalculate_proposal_version_totals();

update public.proposal_versions pv
set total_cost_budget = totals.total_cost,
    total_cost = totals.total_cost,
    total_sale = totals.total_sale,
    budgeted_profit = totals.total_sale - totals.total_cost
from (
  select proposal_version_id, coalesce(sum(cost_budget), 0) total_cost, coalesce(sum(sale_price), 0) total_sale
  from public.budget_lines
  group by proposal_version_id
) totals
where pv.id = totals.proposal_version_id;

