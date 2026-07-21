revoke all on function public.record_contract_signature(uuid,uuid,text,text,text,text,jsonb,boolean,uuid) from public,anon,authenticated;
grant execute on function public.record_contract_signature(uuid,uuid,text,text,text,text,jsonb,boolean,uuid) to service_role;

