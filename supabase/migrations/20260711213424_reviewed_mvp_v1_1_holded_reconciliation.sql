create table if not exists public.holded_sync (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null,
  local_id uuid,
  holded_type text not null,
  trigger text not null,
  holded_entity_id text,
  idempotency_key text not null,
  sync_status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  payload_hash text,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, idempotency_key),
  unique(organization_id, entity_type, local_id, holded_type, trigger)
);

create table if not exists public.purchase_match_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  expected_purchase_id uuid not null references public.expected_purchases(id) on delete cascade,
  holded_purchase_id text not null,
  score numeric(5,2) not null default 0,
  checks jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'candidate',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, expected_purchase_id, holded_purchase_id)
);

create or replace function public.approve_expected_purchase(
  target_org uuid,
  target_purchase uuid,
  target_holded_purchase_id text,
  approved_amount numeric,
  actor uuid,
  review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_purchase public.expected_purchases%rowtype;
  v_line public.budget_lines%rowtype;
  v_now timestamptz:=now();
begin
  select * into v_purchase
  from public.expected_purchases
  where id=target_purchase and organization_id=target_org
  for update;
  if not found then raise exception 'expected_purchase_not_found'; end if;
  if v_purchase.status in ('not_required','cancelled') then raise exception 'purchase_not_approvable'; end if;
  if coalesce(approved_amount,0)<0 then raise exception 'invalid_approved_amount'; end if;
  if nullif(target_holded_purchase_id,'') is null and not exists(select 1 from public.supplier_invoices where expected_purchase_id=target_purchase) then
    raise exception 'invoice_or_holded_purchase_required';
  end if;

  update public.expected_purchases
  set status='approved'::public.expected_purchase_status,
      holded_purchase_id=coalesce(nullif(target_holded_purchase_id,''),holded_purchase_id),
      approved_cost=coalesce(approved_amount,invoice_total,expected_amount,amount,0),
      amount=coalesce(approved_amount,invoice_total,expected_amount,amount,0),
      approved_at=v_now,
      approved_by=actor,
      review_notes=coalesce(nullif(review_note,''),review_notes),
      sync_status=case when nullif(target_holded_purchase_id,'') is null then 'manual_review' else 'synced' end,
      last_synced_at=case when nullif(target_holded_purchase_id,'') is null then last_synced_at else v_now end,
      updated_at=v_now
  where id=target_purchase
  returning * into v_purchase;

  if v_purchase.budget_line_id is not null then
    update public.budget_lines
    set cost_real=v_purchase.approved_cost,
        cost_real_source=case when nullif(v_purchase.holded_purchase_id,'') is not null then 'holded' else 'supplier_invoice' end,
        cost_real_approved_at=v_now,
        cost_real_approved_by=actor,
        updated_at=v_now
    where id=v_purchase.budget_line_id
    returning * into v_line;
    if v_line.proposal_version_id is not null then
      perform public.recalculate_proposal_version_economics(v_line.proposal_version_id);
    end if;
  end if;

  insert into public.timeline_events(organization_id,case_id,event_type,title,payload,created_by)
  values(target_org,v_purchase.case_id,'supplier_purchase.approved','Compra de proveedor aprobada',jsonb_build_object('expected_purchase_id',target_purchase,'holded_purchase_id',v_purchase.holded_purchase_id,'approved_cost',v_purchase.approved_cost),actor);

  insert into public.audit_log(organization_id,actor_id,entity_type,entity_id,action,after_data)
  values(target_org,actor,'expected_purchase',target_purchase,'approved',to_jsonb(v_purchase));

  return jsonb_build_object('purchase',to_jsonb(v_purchase),'line',to_jsonb(v_line));
end;
$$;

