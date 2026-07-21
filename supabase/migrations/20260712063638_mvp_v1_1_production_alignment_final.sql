-- Routsify MVP v1.1 production alignment.
-- Safe to re-apply: every DDL statement is idempotent and secrets stay in Supabase Vault.

create extension if not exists supabase_vault with schema vault;

alter table if exists public.organization_secrets
  add column if not exists vault_secret_id uuid,
  add column if not exists last_tested_at timestamptz,
  add column if not exists last_test_status text,
  add column if not exists last_test_message text;

alter table if exists public.organization_secrets alter column ciphertext drop not null;
alter table if exists public.organization_secrets alter column iv drop not null;
alter table if exists public.organization_secrets alter column auth_tag drop not null;

create unique index if not exists organization_secrets_vault_secret_id_uidx
  on public.organization_secrets(vault_secret_id)
  where vault_secret_id is not null;

create or replace function public.set_organization_secret(
  target_org uuid,
  target_key text,
  secret_value text,
  actor uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_name text;
  v_secret_id uuid;
begin
  if target_key not in ('holded_api_key', 'openai_api_key') then
    raise exception 'unsupported_secret_key';
  end if;
  if length(trim(coalesce(secret_value, ''))) < 8 then
    raise exception 'secret_value_too_short';
  end if;
  if not exists (select 1 from public.organizations where id = target_org) then
    raise exception 'organization_not_found';
  end if;

  v_name := 'routsify:' || target_org::text || ':' || target_key;
  select id into v_secret_id from vault.secrets where name = v_name limit 1;
  if v_secret_id is null then
    select vault.create_secret(secret_value, v_name, 'Routsify organization integration secret') into v_secret_id;
  else
    perform vault.update_secret(v_secret_id, secret_value, v_name, 'Routsify organization integration secret');
  end if;

  insert into public.organization_secrets(
    organization_id, secret_key, vault_secret_id, updated_by, created_at, updated_at
  ) values (
    target_org, target_key, v_secret_id, actor, now(), now()
  )
  on conflict (organization_id, secret_key) do update
    set vault_secret_id = excluded.vault_secret_id,
        ciphertext = null,
        iv = null,
        auth_tag = null,
        updated_by = excluded.updated_by,
        last_tested_at = null,
        last_test_status = null,
        last_test_message = null,
        updated_at = now();

  insert into public.audit_log(organization_id, actor_id, entity_type, action, after_data)
  values (target_org, actor, 'organization_secret', 'secret.updated', jsonb_build_object('secret_key', target_key));

  return jsonb_build_object('configured', true, 'secret_key', target_key, 'updated_at', now());
end;
$$;

create or replace function public.get_organization_secret(
  target_org uuid,
  target_key text
) returns text
language sql
security definer
set search_path = public, vault
stable
as $$
  select ds.decrypted_secret
  from public.organization_secrets os
  join vault.decrypted_secrets ds on ds.id = os.vault_secret_id
  where os.organization_id = target_org
    and os.secret_key = target_key
  limit 1
$$;

create or replace function public.delete_organization_secret(
  target_org uuid,
  target_key text,
  actor uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
begin
  select vault_secret_id into v_secret_id
  from public.organization_secrets
  where organization_id = target_org and secret_key = target_key
  for update;

  delete from public.organization_secrets
  where organization_id = target_org and secret_key = target_key;

  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;

  insert into public.audit_log(organization_id, actor_id, entity_type, action, after_data)
  values (target_org, actor, 'organization_secret', 'secret.deleted', jsonb_build_object('secret_key', target_key));

  return jsonb_build_object('configured', false, 'secret_key', target_key);
end;
$$;

create or replace function public.organization_secret_statuses(target_org uuid)
returns table(
  secret_key text,
  configured boolean,
  updated_at timestamptz,
  last_tested_at timestamptz,
  last_test_status text,
  last_test_message text
)
language sql
security definer
set search_path = public, vault
stable
as $$
  with keys(secret_key) as (
    values ('holded_api_key'::text), ('openai_api_key'::text)
  )
  select k.secret_key,
         (os.vault_secret_id is not null and ds.id is not null) as configured,
         os.updated_at,
         os.last_tested_at,
         os.last_test_status,
         os.last_test_message
  from keys k
  left join public.organization_secrets os
    on os.organization_id = target_org and os.secret_key = k.secret_key
  left join vault.decrypted_secrets ds on ds.id = os.vault_secret_id
  order by k.secret_key
$$;

create or replace function public.record_organization_secret_test(
  target_org uuid,
  target_key text,
  test_status text,
  test_message text default null,
  actor uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.organization_secrets
     set last_tested_at = now(),
         last_test_status = left(coalesce(test_status, 'unknown'), 40),
         last_test_message = left(coalesce(test_message, ''), 500),
         updated_by = coalesce(actor, updated_by),
         updated_at = now()
   where organization_id = target_org and secret_key = target_key;
end;
$$;

revoke all on function public.set_organization_secret(uuid,text,text,uuid) from public, anon, authenticated;
revoke all on function public.get_organization_secret(uuid,text) from public, anon, authenticated;
revoke all on function public.delete_organization_secret(uuid,text,uuid) from public, anon, authenticated;
revoke all on function public.organization_secret_statuses(uuid) from public, anon, authenticated;
revoke all on function public.record_organization_secret_test(uuid,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.set_organization_secret(uuid,text,text,uuid) to service_role;
grant execute on function public.get_organization_secret(uuid,text) to service_role;
grant execute on function public.delete_organization_secret(uuid,text,uuid) to service_role;
grant execute on function public.organization_secret_statuses(uuid) to service_role;
grant execute on function public.record_organization_secret_test(uuid,text,text,text,uuid) to service_role;

-- Business defaults confirmed by Routsify and its advisor.
update public.organizations
set fiscal_mode = 'proforma_on_payment_final_after_trip',
    close_margin_days = 5,
    privacy_retention_days = 1825,
    supplier_invoice_retention_days = 1825,
    updated_at = now();

insert into public.routsify_settings(
  organization_id, module, key, value, default_value, value_type, scope,
  editable, requires_recalculation, affected_modules, updated_at
)
select o.id, v.module, v.key, v.value, v.value, v.value_type, 'global', true, false, v.affected_modules, now()
from public.organizations o
cross join (values
  ('integrations','integrations.holded.modules','["contacts","estimates","proformas","invoices","purchases","payments"]'::jsonb,'multi_select',array['holded','outbox']),
  ('integrations','integrations.holded.mode','"daily"'::jsonb,'select',array['holded','outbox']),
  ('integrations','integrations.openai.ocr_provider','"openai"'::jsonb,'select',array['documents','travelers']),
  ('contracts','payments.provider','"Teya manual"'::jsonb,'select',array['contracts','payments']),
  ('contracts','payments.confirmation_mode','"manual"'::jsonb,'select',array['payments','fiscal']),
  ('fiscal','fiscal.mode','"proforma_on_payment_final_after_trip"'::jsonb,'select',array['payments','holded','reports']),
  ('fiscal','fiscal.final_invoice_delay_days','5'::jsonb,'number',array['fiscal','cases']),
  ('documents','documents.retention_days','1825'::jsonb,'number',array['documents','security']),
  ('security','documents.sensitive_roles','["admin","sales"]'::jsonb,'multi_select',array['documents','travelers'])
) as v(module,key,value,value_type,affected_modules)
on conflict (organization_id,key) do update
set value = excluded.value,
    default_value = excluded.default_value,
    value_type = excluded.value_type,
    affected_modules = excluded.affected_modules,
    updated_at = now();

-- Payment confirmation creates the full-trip proforma request exactly once.
create or replace function public.confirm_external_payment(
  target_org uuid,
  target_case uuid,
  transaction_value text,
  payment_reference_value text,
  amount_value numeric,
  currency_value text,
  provider_value text,
  confirmed_timestamp timestamptz,
  payment_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.cases%rowtype;
  v_payment public.payments%rowtype;
  v_contract_signed boolean;
  v_document public.billing_documents%rowtype;
  v_outbox uuid;
  v_payment_outbox uuid;
begin
  if amount_value is null or amount_value <= 0 then raise exception 'payment_amount_required'; end if;
  if nullif(trim(payment_reference_value),'') is null then raise exception 'payment_reference_required'; end if;

  select * into v_case from public.cases
  where id = target_case and organization_id = target_org
  for update;
  if not found then raise exception 'case_not_found'; end if;

  if coalesce(v_case.accepted_value,0) <= 0
     or not exists (
       select 1 from public.proposals p
       join public.proposal_versions pv on pv.id = p.current_version_id
       where p.case_id = target_case and p.organization_id = target_org
         and p.status = 'accepted' and pv.locked = true
     ) then raise exception 'proposal_not_accepted';
  end if;

  select exists(
    select 1 from public.contracts
    where organization_id = target_org and case_id = target_case and status = 'signed'
  ) into v_contract_signed;
  if not v_contract_signed then raise exception 'contract_not_signed'; end if;

  insert into public.payments(
    organization_id, case_id, payment_reference, transaction_id, idempotency_key,
    reference, provider, method, amount, currency, status, confirmed_at,
    received_at, payload, source, confirmed_by, updated_at
  ) values (
    target_org, target_case, payment_reference_value,
    coalesce(nullif(transaction_value,''), payment_reference_value),
    coalesce(nullif(transaction_value,''), payment_reference_value),
    payment_reference_value, coalesce(nullif(provider_value,''),'teya_manual'),
    coalesce(nullif(provider_value,''),'teya_manual'), amount_value,
    coalesce(nullif(currency_value,''),v_case.currency,'EUR'), 'confirmed',
    coalesce(confirmed_timestamp,now()), coalesce(confirmed_timestamp,now()),
    coalesce(payment_payload,'{}'::jsonb), 'manual',
    case when coalesce(payment_payload->>'actor_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then (payment_payload->>'actor_id')::uuid else null end, now()
  )
  on conflict (organization_id,payment_reference) do update
    set amount = excluded.amount,
        currency = excluded.currency,
        status = 'confirmed',
        confirmed_at = excluded.confirmed_at,
        received_at = excluded.received_at,
        payload = excluded.payload,
        updated_at = now()
  returning * into v_payment;

  insert into public.billing_documents(
    organization_id, case_id, client_id, document_type, type, trigger,
    trigger_name, amount, currency, status, sync_status, idempotency_key,
    sync_message, updated_at
  ) values (
    target_org, target_case, v_case.client_id, 'proforma', 'proforma',
    'payment_confirmed', 'payment_confirmed', v_case.accepted_value,
    coalesce(v_case.currency,'EUR'), 'pending', 'pending',
    'proforma:case:' || target_case::text || ':accepted_total',
    'Pendiente de emisión en Holded por la totalidad del viaje.', now()
  )
  on conflict (organization_id,idempotency_key) do update
    set amount = excluded.amount,
        currency = excluded.currency,
        updated_at = now()
  returning * into v_document;

  update public.cases
     set status = 'payment_confirmed',
         billing_status = 'proforma_pending',
         next_action = 'Emitir proforma total en Holded y coordinar proveedores',
         blocker = null,
         updated_at = now(),
         last_event_at = now()
   where id = target_case and organization_id = target_org;

  insert into public.timeline_events(organization_id,case_id,event_type,title,payload,created_by)
  values(target_org,target_case,'payment.confirmed','Pago confirmado',
         jsonb_build_object('payment_id',v_payment.id,'amount',amount_value,'currency',v_payment.currency,'reference',payment_reference_value,'proforma_id',v_document.id),
         case when coalesce(payment_payload->>'actor_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then (payment_payload->>'actor_id')::uuid else null end);

  v_outbox := public.enqueue_integration_event(
    target_org, 'holded', 'proforma.create',
    'holded:proforma:' || v_document.id::text,
    jsonb_build_object('billing_document_id',v_document.id,'case_id',target_case),
    'high', 'Emitir proforma por el total del viaje al confirmar el primer pago.',
    'Crear proforma en Holded.'
  );

  v_payment_outbox := public.enqueue_integration_event(
    target_org, 'holded', 'payment.sync',
    'holded:payment:' || v_payment.id::text,
    jsonb_build_object('payment_id',v_payment.id,'case_id',target_case),
    'medium', 'Sincronizar el pago confirmado con Holded.',
    'Registrar pago en Holded cuando el endpoint esté disponible.'
  );

  return jsonb_build_object(
    'payment_id',v_payment.id,
    'case_id',target_case,
    'proforma_document_id',v_document.id,
    'outbox_id',v_outbox,
    'payment_outbox_id',v_payment_outbox,
    'status','confirmed'
  );
end;
$$;

revoke all on function public.confirm_external_payment(uuid,uuid,text,text,numeric,text,text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.confirm_external_payment(uuid,uuid,text,text,numeric,text,text,timestamptz,jsonb) to service_role;

