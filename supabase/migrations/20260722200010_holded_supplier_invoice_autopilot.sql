-- HOLD-02: autopiloto de facturas de proveedor desde Holded.
-- Holded sigue siendo la única fuente de entrada de facturas recibidas.

alter table public.suppliers
  add column if not exists invoice_portal_url text,
  add column if not exists invoice_retrieval_method text not null default 'email',
  add column if not exists invoice_grace_days integer not null default 3,
  add column if not exists invoice_retrieval_notes text;

alter table public.suppliers
  drop constraint if exists suppliers_invoice_retrieval_method_check,
  add constraint suppliers_invoice_retrieval_method_check
    check (invoice_retrieval_method in ('portal','email','automatic','not_required'));

alter table public.suppliers
  drop constraint if exists suppliers_invoice_grace_days_check,
  add constraint suppliers_invoice_grace_days_check
    check (invoice_grace_days between 0 and 90);

create index if not exists suppliers_invoice_retrieval_method_idx
  on public.suppliers(organization_id, invoice_retrieval_method);

update public.expected_purchases ep
set invoice_expected_by = coalesce(
  ep.invoice_expected_by,
  ep.due_date,
  (coalesce(bl.end_date, bl.start_date) + make_interval(days => coalesce(s.invoice_grace_days, 3)))::date
)
from public.budget_lines bl, public.suppliers s
where ep.invoice_expected_by is null
  and ep.budget_line_id = bl.id
  and ep.supplier_id = s.id
  and ep.organization_id = bl.organization_id
  and ep.organization_id = s.organization_id
  and coalesce(bl.end_date, bl.start_date) is not null;

create or replace function public.set_expected_purchase_invoice_expected_by()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_line public.budget_lines%rowtype;
  v_grace_days integer := 3;
begin
  if new.invoice_expected_by is not null then
    return new;
  end if;

  if new.supplier_id is not null then
    select coalesce(invoice_grace_days, 3)
      into v_grace_days
    from public.suppliers
    where id = new.supplier_id
      and organization_id = new.organization_id;
  end if;

  if new.budget_line_id is not null then
    select *
      into v_line
    from public.budget_lines
    where id = new.budget_line_id
      and organization_id = new.organization_id;

    if found and coalesce(v_line.end_date, v_line.start_date) is not null then
      new.invoice_expected_by := (coalesce(v_line.end_date, v_line.start_date) + make_interval(days => coalesce(v_grace_days, 3)))::date;
      return new;
    end if;
  end if;

  new.invoice_expected_by := new.due_date;
  return new;
end;
$$;

revoke all on function public.set_expected_purchase_invoice_expected_by() from public, anon, authenticated;
grant execute on function public.set_expected_purchase_invoice_expected_by() to service_role;

drop trigger if exists expected_purchases_set_invoice_expected_by on public.expected_purchases;
create trigger expected_purchases_set_invoice_expected_by
before insert or update of budget_line_id, supplier_id, due_date, invoice_expected_by
on public.expected_purchases
for each row
execute function public.set_expected_purchase_invoice_expected_by();

insert into public.routsify_settings (organization_id, module, setting_key, setting_value, value_type, is_sensitive, editable, created_at, updated_at)
select o.id, 'purchases', defaults.setting_key, defaults.setting_value, defaults.value_type, false, true, now(), now()
from public.organizations o
cross join (
  values
    ('purchases.holded.sync_interval_minutes', '15'::jsonb, 'number'),
    ('purchases.match.auto_reconcile_min_confidence', '95'::jsonb, 'number'),
    ('purchases.match.review_min_confidence', '70'::jsonb, 'number'),
    ('purchases.match.amount_tolerance_percent', '2'::jsonb, 'number'),
    ('purchases.match.amount_tolerance_absolute', '5'::jsonb, 'number')
) as defaults(setting_key, setting_value, value_type)
on conflict (organization_id, setting_key) do nothing;
