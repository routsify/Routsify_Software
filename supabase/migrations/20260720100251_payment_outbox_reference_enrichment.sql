create or replace function public.enrich_holded_payment_outbox_payload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_reference_value text;
begin
  if new.channel = 'holded'
     and new.event_type = 'payment.sync'
     and coalesce(new.payload ->> 'reference', '') = ''
     and coalesce(new.payload ->> 'payment_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    select p.payment_reference
      into payment_reference_value
      from public.payments p
     where p.id = (new.payload ->> 'payment_id')::uuid
       and p.organization_id = new.organization_id
     limit 1;

    if coalesce(payment_reference_value, '') <> '' then
      new.payload := new.payload || jsonb_build_object('reference', payment_reference_value);
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enrich_holded_payment_outbox_payload() from public, anon, authenticated;

drop trigger if exists integration_outbox_enrich_holded_payment on public.integration_outbox;
create trigger integration_outbox_enrich_holded_payment
before insert or update of payload on public.integration_outbox
for each row
execute function public.enrich_holded_payment_outbox_payload();

update public.integration_outbox o
   set payload = o.payload || jsonb_build_object('reference', p.payment_reference)
  from public.payments p
 where o.channel = 'holded'
   and o.event_type = 'payment.sync'
   and coalesce(o.payload ->> 'reference', '') = ''
   and coalesce(o.payload ->> 'payment_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   and p.id = (o.payload ->> 'payment_id')::uuid
   and p.organization_id = o.organization_id;

