create or replace function public.protect_case_closure()
returns trigger language plpgsql set search_path=public as $$
declare close_days integer:=5; confirmed_total numeric:=0; pending_count integer:=0;
begin
  if new.status='closed'::public.case_status and old.status is distinct from new.status then
    select coalesce(close_margin_days,5) into close_days from public.organizations where id=new.organization_id;
    if new.trip_end is null or current_date < new.trip_end + close_days then raise exception 'case_close_delay_not_reached'; end if;
    if new.billing_status <> 'final_invoice_issued' then raise exception 'final_invoice_not_issued'; end if;
    if new.operational_closed_at is null or new.closed_at is null then raise exception 'operational_close_evidence_required'; end if;
    if not exists(select 1 from public.contracts c join public.signature_evidence se on se.contract_version_id=c.current_version_id and se.contract_id=c.id where c.organization_id=new.organization_id and c.case_id=new.id and c.status='signed') then raise exception 'signed_contract_evidence_required'; end if;
    select coalesce(sum(amount),0) into confirmed_total from public.payments where organization_id=new.organization_id and case_id=new.id and status='confirmed';
    if confirmed_total < coalesce(new.accepted_value,0) then raise exception 'payment_incomplete'; end if;
    select count(*) into pending_count from public.expected_purchases where organization_id=new.organization_id and case_id=new.id and active=true and required=true and status not in ('approved','not_required','cancelled');
    if pending_count>0 then raise exception 'supplier_purchases_pending'; end if;
  end if;
  return new;
end $$;

