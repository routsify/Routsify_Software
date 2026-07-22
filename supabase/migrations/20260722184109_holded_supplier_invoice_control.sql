-- Holded is the source of received supplier invoices.
-- Routsify keeps the operational register of expected purchases and reconciles
-- what Holded has already received through OCR.

alter table public.expected_purchases
  add column if not exists invoice_expected_by date,
  add column if not exists allow_partial_invoicing boolean not null default false;

update public.expected_purchases
set invoice_expected_by = coalesce(invoice_expected_by, due_date)
where invoice_expected_by is null and due_date is not null;

alter table public.supplier_invoices
  add column if not exists holded_contact_id text,
  add column if not exists holded_updated_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists holded_status text,
  add column if not exists source_payload_hash text,
  add column if not exists holded_url text,
  add column if not exists source_payload jsonb not null default '{}'::jsonb;

create unique index if not exists supplier_invoices_holded_purchase_once_idx
  on public.supplier_invoices(organization_id, holded_purchase_id)
  where holded_purchase_id is not null and holded_purchase_id <> '';

create unique index if not exists supplier_invoices_expected_holded_once_idx
  on public.supplier_invoices(organization_id, expected_purchase_id, holded_purchase_id)
  where expected_purchase_id is not null and holded_purchase_id is not null and holded_purchase_id <> '';

create unique index if not exists expected_purchases_single_holded_purchase_idx
  on public.expected_purchases(organization_id, holded_purchase_id)
  where holded_purchase_id is not null and holded_purchase_id <> '';

create index if not exists expected_purchases_invoice_expected_by_idx
  on public.expected_purchases(organization_id, status, invoice_expected_by)
  where active is true;

create index if not exists supplier_invoices_holded_contact_idx
  on public.supplier_invoices(organization_id, holded_contact_id);

create index if not exists supplier_invoices_last_seen_idx
  on public.supplier_invoices(organization_id, last_seen_at desc);

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
  v_invoice public.supplier_invoices%rowtype;
  v_now timestamptz:=now();
begin
  select * into v_purchase
  from public.expected_purchases
  where id=target_purchase and organization_id=target_org
  for update;
  if not found then raise exception 'expected_purchase_not_found'; end if;
  if v_purchase.status in ('not_required','cancelled') then raise exception 'purchase_not_approvable'; end if;
  if coalesce(approved_amount,0)<0 then raise exception 'invalid_approved_amount'; end if;

  if nullif(target_holded_purchase_id,'') is null then
    select * into v_invoice
    from public.supplier_invoices
    where organization_id=target_org and expected_purchase_id=target_purchase
    order by coalesce(holded_updated_at,last_seen_at,created_at) desc
    limit 1;
    if not found then raise exception 'invoice_or_holded_purchase_required'; end if;
  else
    select * into v_invoice
    from public.supplier_invoices
    where organization_id=target_org and holded_purchase_id=target_holded_purchase_id
    for update;

    if found and v_invoice.expected_purchase_id is not null and v_invoice.expected_purchase_id <> target_purchase then
      raise exception 'holded_invoice_already_linked';
    end if;
  end if;

  update public.expected_purchases
  set status='approved'::public.expected_purchase_status,
      holded_purchase_id=coalesce(nullif(target_holded_purchase_id,''),holded_purchase_id,v_invoice.holded_purchase_id),
      invoice_number=coalesce(invoice_number,v_invoice.invoice_number),
      invoice_date=coalesce(invoice_date,v_invoice.invoice_date),
      invoice_base=coalesce(invoice_base,v_invoice.base_amount),
      invoice_tax=coalesce(invoice_tax,v_invoice.tax_amount),
      invoice_total=coalesce(invoice_total,v_invoice.total_amount),
      approved_cost=coalesce(approved_amount,v_invoice.total_amount,invoice_total,expected_amount,amount,0),
      amount=coalesce(approved_amount,v_invoice.total_amount,invoice_total,expected_amount,amount,0),
      approved_at=v_now,
      approved_by=actor,
      review_notes=coalesce(nullif(review_note,''),review_notes),
      sync_status='synced',
      last_synced_at=v_now,
      updated_at=v_now
  where id=target_purchase
  returning * into v_purchase;

  if nullif(v_purchase.holded_purchase_id,'') is not null then
    update public.supplier_invoices
    set expected_purchase_id=target_purchase,
        supplier_id=coalesce(supplier_id,v_purchase.supplier_id),
        status='approved',
        reviewed_at=coalesce(reviewed_at,v_now),
        approved_at=coalesce(approved_at,v_now),
        reviewed_by=coalesce(reviewed_by,actor),
        approved_by=coalesce(approved_by,actor),
        updated_at=v_now
    where organization_id=target_org and holded_purchase_id=v_purchase.holded_purchase_id;
  end if;

  update public.purchase_match_candidates
  set status=case when holded_purchase_id=v_purchase.holded_purchase_id then 'accepted' else 'rejected' end,
      reviewed_by=actor,
      reviewed_at=v_now,
      updated_at=v_now
  where organization_id=target_org and expected_purchase_id=target_purchase and status='candidate';

  if v_purchase.budget_line_id is not null then
    update public.budget_lines
    set cost_real=v_purchase.approved_cost,
        cost_real_source='holded',
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
  values(target_org,v_purchase.case_id,'supplier_purchase.approved','Compra de proveedor conciliada con Holded',jsonb_build_object('expected_purchase_id',target_purchase,'holded_purchase_id',v_purchase.holded_purchase_id,'approved_cost',v_purchase.approved_cost),actor);

  insert into public.audit_log(organization_id,actor_id,entity_type,entity_id,action,after_data)
  values(target_org,actor,'expected_purchase',target_purchase,'approved',to_jsonb(v_purchase));

  return jsonb_build_object('purchase',to_jsonb(v_purchase),'line',to_jsonb(v_line));
end;
$$;

revoke all on function public.approve_expected_purchase(uuid,uuid,text,numeric,uuid,text) from public, anon, authenticated;
grant execute on function public.approve_expected_purchase(uuid,uuid,text,numeric,uuid,text) to service_role;
