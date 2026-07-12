-- Prevent direct case closure when the operational preflight has blockers.
create or replace function public.protect_case_operational_close()
returns trigger language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  if new.status='closed' and old.status is distinct from 'closed' then
    result:=public.operational_close_preflight(new.id);
    if coalesce((result->>'ready')::boolean,false)=false then
      raise exception 'case_close_preflight_failed';
    end if;
    new.closed_at:=coalesce(new.closed_at,now());
    new.operational_closed_at:=coalesce(new.operational_closed_at,now());
  end if;
  return new;
end;$$;
drop trigger if exists trg_protect_case_operational_close on public.cases;
create trigger trg_protect_case_operational_close
before update of status on public.cases
for each row execute function public.protect_case_operational_close();
