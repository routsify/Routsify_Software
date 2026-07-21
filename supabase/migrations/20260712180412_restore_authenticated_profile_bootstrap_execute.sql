revoke all on function public.ensure_profile_for_current_user() from public, anon;
grant execute on function public.ensure_profile_for_current_user() to authenticated;
grant execute on function public.ensure_profile_for_current_user() to service_role;

