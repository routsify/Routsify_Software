drop trigger if exists trg_protect_case_closure on public.cases;
create trigger trg_protect_case_closure before update of status on public.cases for each row execute function public.protect_case_closure();
revoke all on function public.protect_case_closure() from public,anon,authenticated;
grant execute on function public.protect_case_closure() to service_role;

