-- Harden helper functions used by RLS policies.
-- These functions are needed internally by policies but should not be callable as public RPC endpoints.

revoke execute on function public.current_org_id() from anon, authenticated, public;
revoke execute on function public.current_app_role() from anon, authenticated, public;
