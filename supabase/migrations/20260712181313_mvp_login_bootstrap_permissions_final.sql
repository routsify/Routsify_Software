REVOKE EXECUTE ON FUNCTION public.ensure_profile_for_current_user() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_profile_for_current_user() TO service_role;

