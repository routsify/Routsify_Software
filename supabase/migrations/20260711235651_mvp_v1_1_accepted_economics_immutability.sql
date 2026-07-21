create or replace function public.protect_locked_proposal_version()
returns trigger language plpgsql set search_path=public as $$
begin
  if old.locked or old.status='accepted'::public.proposal_version_status then
    if new.status is distinct from old.status or new.locked is distinct from true or new.version_number is distinct from old.version_number or new.proposal_id is distinct from old.proposal_id or new.total_sale is distinct from old.total_sale or new.total_cost_budget is distinct from old.total_cost_budget or new.budgeted_profit is distinct from old.budgeted_profit or new.terms_snapshot is distinct from old.terms_snapshot or new.margin_snapshot is distinct from old.margin_snapshot or new.margin_rules_snapshot_json is distinct from old.margin_rules_snapshot_json or new.formula_version_id is distinct from old.formula_version_id or new.narrative is distinct from old.narrative then raise exception 'accepted_proposal_version_is_immutable'; end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_locked_proposal_version on public.proposal_versions;
create trigger trg_protect_locked_proposal_version before update on public.proposal_versions for each row execute function public.protect_locked_proposal_version();

create or replace function public.protect_locked_budget_lines()
returns trigger language plpgsql set search_path=public as $$
declare target_version uuid; is_locked boolean;
begin
  target_version:=case when tg_op='DELETE' then old.proposal_version_id else new.proposal_version_id end;
  select locked or status='accepted'::public.proposal_version_status into is_locked from public.proposal_versions where id=target_version;
  if coalesce(is_locked,false) then
    if tg_op in ('INSERT','DELETE') then raise exception 'accepted_budget_lines_are_immutable'; end if;
    if new.stable_line_id is distinct from old.stable_line_id or new.service_type_id is distinct from old.service_type_id or new.service_type_code is distinct from old.service_type_code or new.description_internal is distinct from old.description_internal or new.description_public is distinct from old.description_public or new.supplier_id is distinct from old.supplier_id or new.supplier_name is distinct from old.supplier_name or new.destination_segment is distinct from old.destination_segment or new.start_date is distinct from old.start_date or new.end_date is distinct from old.end_date or new.cost_budget is distinct from old.cost_budget or new.margin_applied is distinct from old.margin_applied or new.sale_price is distinct from old.sale_price or new.included is distinct from old.included or new.origin_margin is distinct from old.origin_margin or new.formula_version_id is distinct from old.formula_version_id or new.margin_snapshot is distinct from old.margin_snapshot or new.sort_order is distinct from old.sort_order then raise exception 'accepted_budget_lines_are_immutable'; end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
drop trigger if exists trg_protect_locked_budget_lines on public.budget_lines;
create trigger trg_protect_locked_budget_lines before insert or update or delete on public.budget_lines for each row execute function public.protect_locked_budget_lines();

create or replace function public.protect_accepted_proposal_status()
returns trigger language plpgsql set search_path=public as $$
begin
  if old.status='accepted' and new.status is distinct from old.status then raise exception 'accepted_proposal_cannot_be_reopened'; end if;
  return new;
end $$;
drop trigger if exists trg_protect_accepted_proposal_status on public.proposals;
create trigger trg_protect_accepted_proposal_status before update on public.proposals for each row execute function public.protect_accepted_proposal_status();

revoke all on function public.protect_locked_proposal_version() from public,anon,authenticated;
revoke all on function public.protect_locked_budget_lines() from public,anon,authenticated;
revoke all on function public.protect_accepted_proposal_status() from public,anon,authenticated;
grant execute on function public.protect_locked_proposal_version() to service_role;
grant execute on function public.protect_locked_budget_lines() to service_role;
grant execute on function public.protect_accepted_proposal_status() to service_role;

