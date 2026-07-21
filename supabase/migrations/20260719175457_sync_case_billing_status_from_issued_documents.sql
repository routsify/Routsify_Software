create or replace function public.sync_case_billing_status_from_document()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.case_id is null or new.status <> 'issued' then
    return new;
  end if;

  if coalesce(new.document_type, new.type) = 'final_invoice' then
    update public.cases
    set billing_status = 'final_invoice_issued',
        next_action = case when operational_closed_at is null then 'Cerrar expediente' else next_action end,
        blocker = null,
        updated_at = now()
    where id = new.case_id
      and organization_id = new.organization_id;
  elsif coalesce(new.document_type, new.type) = 'proforma' then
    update public.cases
    set billing_status = case when billing_status = 'final_invoice_issued' then billing_status else 'proforma_issued' end,
        updated_at = now()
    where id = new.case_id
      and organization_id = new.organization_id;
  end if;

  return new;
end;
$$;

drop trigger if exists billing_documents_sync_case_status on public.billing_documents;
create trigger billing_documents_sync_case_status
after insert or update of status on public.billing_documents
for each row execute function public.sync_case_billing_status_from_document();

