-- The browser no longer calls this profile bootstrap helper.
-- New profiles are created by the auth.users trigger and existing profiles are read server-side.

revoke all on function public.ensure_profile_for_current_user() from public, anon, authenticated;
grant execute on function public.ensure_profile_for_current_user() to service_role;
