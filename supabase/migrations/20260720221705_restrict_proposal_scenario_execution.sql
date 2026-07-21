-- The function is invoked exclusively by service-role server code. Explicitly
-- remove direct Data API execution inherited by anon/authenticated roles.
revoke all on function public.apply_proposal_scenario(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.apply_proposal_scenario(uuid, uuid, uuid)
  to service_role;

