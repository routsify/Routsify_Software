create or replace function public.accept_proposal_version(target_version uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_version public.proposal_versions%rowtype;
  v_proposal public.proposals%rowtype;
  v_now timestamptz:=now();
  v_purchase_count integer:=0;
begin
  select * into v_version from public.proposal_versions where id=target_version for update;
  if not found then raise exception 'proposal_version_not_found'; end if;
  select * into v_proposal from public.proposals where id=v_version.proposal_id for update;
  if not found then raise exception 'proposal_not_found'; end if;
  if v_proposal.status='accepted' and v_proposal.current_version_id is distinct from target_version then raise exception 'accepted_proposal_locked'; end if;
  perform public.recalculate_proposal_version_economics(target_version);
  select * into v_version from public.proposal_versions where id=target_version for update;
  if coalesce(v_version.total_sale,0)<=0 then raise exception 'proposal_total_required'; end if;
  if not exists(select 1 from public.budget_lines where proposal_version_id=target_version and included=true) then raise exception 'proposal_requires_included_lines'; end if;

  update public.proposal_versions
  set status='accepted',accepted_at=coalesce(accepted_at,v_now),locked_at=coalesce(locked_at,v_now),locked=true,
      margin_rules_snapshot_json=coalesce((select jsonb_object_agg(stable_line_id,coalesce(margin_snapshot,'{}'::jsonb)) from public.budget_lines where proposal_version_id=target_version),'{}'::jsonb),
      snapshot=jsonb_build_object('accepted_at',v_now,'formula_version_id',formula_version_id,'financial_summary',financial_summary_json,'line_count',(select count(*) from public.budget_lines where proposal_version_id=target_version and included=true)),
      updated_at=v_now
  where id=target_version;

  update public.proposal_versions set status='expired',updated_at=v_now
  where proposal_id=v_proposal.id and id<>target_version and status in ('draft','sent','internal_review');

  update public.proposals set status='accepted',current_version_id=target_version,public_token_hash=null,public_token_expires_at=null,updated_at=v_now where id=v_proposal.id;
  update public.cases set status='proposal_accepted',accepted_value=v_version.total_sale,next_action='Solicitar datos de viajeros',blocker=null,last_activity_at=v_now,updated_at=v_now,last_event_at=v_now where id=v_proposal.case_id;

  update public.expected_purchases ep
  set status='cancelled',active=false,cancelled_at=v_now,cancellation_reason='La línea no forma parte del conjunto aceptado.',updated_at=v_now
  where ep.proposal_version_id=target_version and ep.budget_line_id in (
    select id from public.budget_lines where proposal_version_id=target_version and (included=false or creates_expected_purchase=false)
  ) and ep.status not in ('approved','not_required','cancelled');

  insert into public.expected_purchases(organization_id,case_id,proposal_version_id,budget_line_id,supplier_id,supplier_name,provider_hash,service,expected_amount,amount,currency,status,required,active,review_notes)
  select line.organization_id,v_proposal.case_id,target_version,line.id,line.supplier_id,nullif(line.supplier_name,''),encode(digest(lower(coalesce(nullif(line.supplier_name,''),line.supplier_id::text,'')),'sha256'),'hex'),line.description_public,line.cost_budget,line.cost_budget,'EUR','expected'::public.expected_purchase_status,true,true,'Generada automáticamente al aceptar la versión.'
  from public.budget_lines line
  where line.proposal_version_id=target_version and line.included=true and line.creates_expected_purchase=true
    and (line.supplier_id is not null or nullif(line.supplier_name,'') is not null or coalesce(line.cost_budget,0)>0)
  on conflict (proposal_version_id,budget_line_id) where budget_line_id is not null
  do update set supplier_id=excluded.supplier_id,supplier_name=excluded.supplier_name,provider_hash=excluded.provider_hash,service=excluded.service,expected_amount=excluded.expected_amount,amount=excluded.amount,required=true,active=true,status=case when public.expected_purchases.status='cancelled' then 'expected'::public.expected_purchase_status else public.expected_purchases.status end,updated_at=v_now;
  get diagnostics v_purchase_count=row_count;

  update public.budget_lines bl set expected_purchase_id=ep.id,updated_at=v_now
  from public.expected_purchases ep
  where bl.proposal_version_id=target_version and ep.proposal_version_id=target_version and ep.budget_line_id=bl.id;

  insert into public.timeline_events(organization_id,case_id,event_type,title,payload)
  values(v_version.organization_id,v_proposal.case_id,'proposal.accepted','Presupuesto aceptado',jsonb_build_object('proposal_id',v_proposal.id,'version_id',target_version,'expected_purchases_upserted',v_purchase_count));
  insert into public.audit_log(organization_id,entity_type,entity_id,action,after_data)
  values(v_version.organization_id,'proposal_version',target_version,'accepted',jsonb_build_object('proposal_id',v_proposal.id,'case_id',v_proposal.case_id,'expected_purchases_upserted',v_purchase_count,'financial_summary',v_version.financial_summary_json));
  return jsonb_build_object('proposal_id',v_proposal.id,'version_id',target_version,'accepted_at',v_now,'expected_purchases_created',v_purchase_count);
end;
$$;

