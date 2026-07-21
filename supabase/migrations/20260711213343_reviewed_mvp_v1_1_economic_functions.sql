create or replace function public.recalculate_proposal_version_economics(target_version uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_sale numeric(14,2):=0;
  v_budget numeric(14,2):=0;
  v_real numeric(14,2):=0;
  v_budget_profit numeric(14,2):=0;
  v_real_profit numeric(14,2):=0;
  v_real_margin numeric(9,6):=0;
  v_summary jsonb;
begin
  select
    coalesce(sum(case when included then sale_price else 0 end),0),
    coalesce(sum(case when included then cost_budget else 0 end),0),
    coalesce(sum(case when included then coalesce(cost_real,cost_budget) else 0 end),0)
  into v_sale,v_budget,v_real
  from public.budget_lines
  where proposal_version_id=target_version;

  v_budget_profit:=v_sale-v_budget;
  v_real_profit:=v_sale-v_real;
  v_real_margin:=case when v_sale=0 then 0 else v_real_profit/v_sale end;
  v_summary:=jsonb_build_object(
    'total_sale',v_sale,
    'total_cost_budget',v_budget,
    'total_cost_real',v_real,
    'budgeted_profit',v_budget_profit,
    'real_profit',v_real_profit,
    'budgeted_margin_pct',case when v_sale=0 then 0 else v_budget_profit/v_sale end,
    'real_margin_pct',v_real_margin,
    'cost_deviation',v_real-v_budget,
    'profit_deviation',v_real_profit-v_budget_profit,
    'calculated_at',now()
  );

  update public.proposal_versions
  set total_sale=v_sale,
      total_cost=v_budget,
      total_cost_budget=v_budget,
      total_cost_real=v_real,
      budgeted_profit=v_budget_profit,
      real_profit=v_real_profit,
      real_margin_pct=v_real_margin,
      cost_deviation=v_real-v_budget,
      financial_summary_json=v_summary,
      updated_at=now()
  where id=target_version;

  return v_summary;
end;
$$;

create or replace function public.recalculate_proposal_version_totals()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op='DELETE' then
    perform public.recalculate_proposal_version_economics(old.proposal_version_id);
    return old;
  end if;
  perform public.recalculate_proposal_version_economics(new.proposal_version_id);
  return new;
end;
$$;

drop trigger if exists trg_recalculate_proposal_version_totals on public.budget_lines;
create trigger trg_recalculate_proposal_version_totals
after insert or update or delete on public.budget_lines
for each row execute function public.recalculate_proposal_version_totals();

