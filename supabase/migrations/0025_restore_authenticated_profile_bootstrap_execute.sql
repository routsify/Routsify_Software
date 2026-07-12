-- Restore the authenticated login bootstrap permission.
-- The login form calls this SECURITY DEFINER function only after Supabase Auth
-- has established a valid user session. Anonymous execution remains blocked.

revoke all on function public.ensure_profile_for_current_user() from public, anon;
grant execute on function public.ensure_profile_for_current_user() to authenticated;
grant execute on function public.ensure_profile_for_current_user() to service_role;
