alter table public.organizations alter column close_margin_days set default 5;
alter table public.organizations alter column privacy_retention_days set default 1825;
alter table public.organizations alter column supplier_invoice_retention_days set default 1825;
create unique index if not exists contracts_org_case_uidx on public.contracts(organization_id,case_id);

