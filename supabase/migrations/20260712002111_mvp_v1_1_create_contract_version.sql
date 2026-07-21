create or replace function public.create_contract_version(
  target_org uuid,
  target_case uuid,
  contract_title text,
  legal_version_value text,
  external_url_value text,
  notes_value text,
  contract_status_value text,
  actor uuid
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_case public.cases%rowtype;
  v_client jsonb;
  v_proposal public.proposals%rowtype;
  v_version public.proposal_versions%rowtype;
  v_contract public.contracts%rowtype;
  v_contract_version public.contract_versions%rowtype;
  v_travelers jsonb;
  adult_count integer:=0;
  pending_travelers integer:=0;
  next_version integer:=1;
  normalized_status text:=coalesce(nullif(contract_status_value,''),'draft');
begin
  if normalized_status not in ('draft','sent') then raise exception 'invalid_contract_status'; end if;
  if nullif(trim(coalesce(legal_version_value,'')),'') is null then raise exception 'legal_version_required'; end if;
  if normalized_status='sent' and nullif(trim(coalesce(external_url_value,'')),'') is null then raise exception 'contract_url_required_before_send'; end if;
  select * into v_case from public.cases where id=target_case and organization_id=target_org for update;
  if not found then raise exception 'case_not_found'; end if;
  if v_case.trip_start is null or v_case.trip_end is null then raise exception 'trip_dates_required'; end if;
  if coalesce(v_case.accepted_value,0)<=0 then raise exception 'accepted_total_required'; end if;
  select p.* into v_proposal from public.proposals p join public.proposal_versions pv on pv.id=p.current_version_id where p.organization_id=target_org and p.case_id=target_case and p.status='accepted' and pv.status='accepted'::public.proposal_version_status and pv.locked=true order by p.updated_at desc limit 1;
  if not found then raise exception 'accepted_locked_proposal_required'; end if;
  select * into v_version from public.proposal_versions where id=v_proposal.current_version_id;
  if nullif(trim(coalesce(v_version.terms_snapshot,'')),'') is null then raise exception 'accepted_terms_required'; end if;
  select count(*) filter(where traveler_type='adult'), count(*) filter(where review_status<>'approved'::public.traveler_review_status) into adult_count,pending_travelers from public.travelers where organization_id=target_org and case_id=target_case;
  if adult_count=0 then raise exception 'approved_adult_traveler_required'; end if;
  if pending_travelers>0 then raise exception 'all_travelers_must_be_approved'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'traveler_type',traveler_type,'first_name',first_name,'last_name',last_name,'birth_date',birth_date,'nationality',nationality,'document_type',document_type,'document_number',document_number,'issuing_country',coalesce(issuing_country,document_country),'document_expires_at',document_expires_at,'review_status',review_status) order by created_at),'[]'::jsonb) into v_travelers from public.travelers where organization_id=target_org and case_id=target_case;
  select to_jsonb(c) into v_client from public.clients c where c.id=v_case.client_id and c.organization_id=target_org;
  select * into v_contract from public.contracts where organization_id=target_org and case_id=target_case for update;
  if found and v_contract.status='signed' then raise exception 'signed_contract_is_immutable'; end if;
  if not found then
    insert into public.contracts(organization_id,case_id,title,status,external_url,notes,proposal_version_id,legal_version,reviewed_at,reviewed_by) values(target_org,target_case,coalesce(nullif(trim(contract_title),''),'Contrato de viaje'),normalized_status,nullif(trim(external_url_value),''),nullif(trim(notes_value),''),v_version.id,trim(legal_version_value),now(),actor) returning * into v_contract;
  else
    update public.contracts set title=coalesce(nullif(trim(contract_title),''),title),status=normalized_status,external_url=nullif(trim(external_url_value),''),notes=nullif(trim(notes_value),''),proposal_version_id=v_version.id,legal_version=trim(legal_version_value),reviewed_at=now(),reviewed_by=actor,updated_at=now() where id=v_contract.id returning * into v_contract;
  end if;
  select coalesce(max(version_number),0)+1 into next_version from public.contract_versions where contract_id=v_contract.id;
  insert into public.contract_versions(organization_id,contract_id,case_id,proposal_version_id,version_number,legal_version,content_snapshot,status,created_by) values(target_org,v_contract.id,target_case,v_version.id,next_version,trim(legal_version_value),jsonb_build_object('case',jsonb_build_object('id',v_case.id,'case_code',v_case.case_code,'title',v_case.title,'destination',v_case.destination,'trip_start',v_case.trip_start,'trip_end',v_case.trip_end,'currency',v_case.currency),'client',coalesce(v_client,'{}'::jsonb),'travelers',v_travelers,'proposal',jsonb_build_object('id',v_proposal.id,'version_id',v_version.id,'version_number',v_version.version_number,'title',v_version.title,'narrative',v_version.narrative,'terms',v_version.terms_snapshot,'total_sale',v_version.total_sale,'currency',v_case.currency),'legal_version',trim(legal_version_value),'generated_at',now()),normalized_status,actor) returning * into v_contract_version;
  update public.contracts set current_version_id=v_contract_version.id,version=next_version,updated_at=now() where id=v_contract.id returning * into v_contract;
  update public.cases set status='contract_ready'::public.case_status,next_action=case when normalized_status='sent' then 'Esperar firma del contrato' else 'Enviar contrato al cliente' end,blocker=null,last_activity_at=now(),updated_at=now() where id=target_case;
  insert into public.timeline_events(organization_id,case_id,event_type,title,payload,created_by) values(target_org,target_case,'contract.version_created',case when normalized_status='sent' then 'Contrato generado y enviado' else 'Nueva versión de contrato generada' end,jsonb_build_object('contract_id',v_contract.id,'contract_version_id',v_contract_version.id,'version',next_version,'legal_version',legal_version_value,'status',normalized_status),actor);
  insert into public.audit_log(organization_id,actor_id,entity_type,entity_id,action,after_data) values(target_org,actor,'contract',v_contract.id,'contract.version_created',jsonb_build_object('contract_version_id',v_contract_version.id,'version_number',next_version,'proposal_version_id',v_version.id,'legal_version',legal_version_value,'status',normalized_status));
  return jsonb_build_object('contract',to_jsonb(v_contract),'version',to_jsonb(v_contract_version));
end $$;
revoke all on function public.create_contract_version(uuid,uuid,text,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.create_contract_version(uuid,uuid,text,text,text,text,text,uuid) to service_role;

