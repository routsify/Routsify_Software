create or replace function public.record_contract_signature(target_org uuid,target_contract uuid,signer_name_value text,signer_email_value text,ip_hash_value text,user_agent_value text,evidence_value jsonb,review_confirmed boolean,actor uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  contract_row public.contracts%rowtype;
  version_row public.contract_versions%rowtype;
  evidence_row public.signature_evidence%rowtype;
begin
  if review_confirmed is not true then raise exception 'contract_review_confirmation_required'; end if;
  if nullif(trim(coalesce(signer_name_value,'')),'') is null then raise exception 'signer_name_required'; end if;
  select * into contract_row from public.contracts where id=target_contract and organization_id=target_org for update;
  if not found then raise exception 'contract_not_found'; end if;
  select * into version_row from public.contract_versions where id=contract_row.current_version_id and contract_id=contract_row.id for update;
  if not found then raise exception 'contract_version_not_found'; end if;
  if not exists(select 1 from public.proposals p join public.proposal_versions pv on pv.id=p.current_version_id where p.organization_id=target_org and p.case_id=contract_row.case_id and p.status='accepted' and pv.id=version_row.proposal_version_id and pv.locked=true) then raise exception 'accepted_contract_proposal_mismatch'; end if;
  select * into evidence_row from public.signature_evidence where contract_version_id=version_row.id;
  if found then return jsonb_build_object('contract',to_jsonb(contract_row),'version',to_jsonb(version_row),'evidence',to_jsonb(evidence_row),'duplicate',true); end if;
  insert into public.signature_evidence(organization_id,case_id,contract_id,contract_version_id,proposal_version_id,signer_name,signer_email,ip_hash,user_agent,evidence)
  values(target_org,contract_row.case_id,contract_row.id,version_row.id,version_row.proposal_version_id,trim(signer_name_value),nullif(trim(signer_email_value),''),nullif(ip_hash_value,''),nullif(user_agent_value,''),coalesce(evidence_value,'{}'::jsonb)) returning * into evidence_row;
  update public.contract_versions set status='signed',locked_at=now() where id=version_row.id returning * into version_row;
  update public.contracts set status='signed',signed_at=evidence_row.signed_at,signed_by_name=evidence_row.signer_name,signed_by_email=evidence_row.signer_email,signature_ip_hash=evidence_row.ip_hash,signature_user_agent=evidence_row.user_agent,reviewed_at=coalesce(reviewed_at,now()),reviewed_by=coalesce(reviewed_by,actor),updated_at=now() where id=contract_row.id returning * into contract_row;
  update public.cases set status='contract_signed'::public.case_status,next_action='Añadir enlace de pago y confirmar cobro',blocker=null,last_activity_at=now(),updated_at=now() where id=contract_row.case_id;
  insert into public.timeline_events(organization_id,case_id,event_type,title,payload,created_by) values(target_org,contract_row.case_id,'contract.signed','Contrato firmado',jsonb_build_object('contract_id',contract_row.id,'contract_version_id',version_row.id,'signer_name',evidence_row.signer_name),actor);
  insert into public.audit_log(organization_id,actor_id,entity_type,entity_id,action,after_data) values(target_org,actor,'contract',contract_row.id,'contract.signed',jsonb_build_object('contract_version_id',version_row.id,'proposal_version_id',version_row.proposal_version_id,'signature_evidence_id',evidence_row.id,'signer_name',evidence_row.signer_name,'signed_at',evidence_row.signed_at));
  return jsonb_build_object('contract',to_jsonb(contract_row),'version',to_jsonb(version_row),'evidence',to_jsonb(evidence_row),'duplicate',false);
end
$$;

