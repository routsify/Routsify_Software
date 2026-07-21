create or replace function public.protect_locked_budget_lines()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_version uuid; v_locked boolean:=false;
begin
  v_version:=case when tg_op='DELETE' then old.proposal_version_id else new.proposal_version_id end;
  select locked into v_locked from public.proposal_versions where id=v_version;
  if coalesce(v_locked,false)=false then return case when tg_op='DELETE' then old else new end; end if;
  if tg_op in ('INSERT','DELETE') then raise exception 'proposal_version_locked'; end if;
  if (to_jsonb(new)-array['cost_real','cost_real_source','cost_real_approved_at','cost_real_approved_by','manual_real_cost_reason','expected_purchase_id','updated_at'])
     is distinct from
     (to_jsonb(old)-array['cost_real','cost_real_source','cost_real_approved_at','cost_real_approved_by','manual_real_cost_reason','expected_purchase_id','updated_at']) then
    raise exception 'proposal_version_locked';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_locked_budget_lines on public.budget_lines;
create trigger trg_protect_locked_budget_lines
before insert or update or delete on public.budget_lines
for each row execute function public.protect_locked_budget_lines();
revoke all on function public.protect_locked_budget_lines() from public,anon,authenticated;

