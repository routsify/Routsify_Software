-- Production hardening: SECURITY DEFINER helpers must not be callable by anonymous users.

revoke execute on function public.ensure_profile_for_current_user() from anon;

-- Some deployments created this auth hook. Keep this guarded if it exists.
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'handle_new_auth_user'
  ) then
    execute 'revoke execute on function public.handle_new_auth_user() from anon';
  end if;
end $$;
