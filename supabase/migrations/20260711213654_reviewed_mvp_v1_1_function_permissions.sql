revoke all on function public.recalculate_proposal_version_totals() from public,anon,authenticated;
revoke all on function public.track_case_status_change() from public,anon,authenticated;
revoke all on function public.accept_proposal_version(uuid) from public,anon,authenticated;
revoke all on function public.next_case_code(uuid,integer) from public,anon,authenticated;
revoke all on function public.recalculate_proposal_version_economics(uuid) from public,anon,authenticated;
revoke all on function public.approve_expected_purchase(uuid,uuid,text,numeric,uuid,text) from public,anon,authenticated;
revoke all on function public.sign_contract_version(uuid,uuid,text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.mark_expired_sensitive_documents(uuid,uuid) from public,anon,authenticated;
revoke all on function public.operational_close_preflight(uuid) from public,anon,authenticated;
revoke all on function public.close_operational_case(uuid,uuid) from public,anon,authenticated;

grant execute on function public.accept_proposal_version(uuid) to service_role;
grant execute on function public.next_case_code(uuid,integer) to service_role;
grant execute on function public.recalculate_proposal_version_economics(uuid) to service_role;
grant execute on function public.approve_expected_purchase(uuid,uuid,text,numeric,uuid,text) to service_role;
grant execute on function public.sign_contract_version(uuid,uuid,text,text,text,text,jsonb) to service_role;
grant execute on function public.mark_expired_sensitive_documents(uuid,uuid) to service_role;
grant execute on function public.operational_close_preflight(uuid) to service_role;
grant execute on function public.close_operational_case(uuid,uuid) to service_role;

