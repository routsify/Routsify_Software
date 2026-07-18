-- Add the outbound Routsify Booking API key to the Vault-backed catalogue.
-- Existing secrets and booking rows are preserved.

alter table public.organization_secrets
  drop constraint if exists organization_secrets_secret_key_check;

alter table public.organization_secrets
  add constraint organization_secrets_secret_key_check
  check (secret_key = any (array[
    'holded_api_key'::text,
    'openai_api_key'::text,
    'fillout_webhook_secret'::text,
    'booking_webhook_secret'::text,
    'booking_api_key'::text,
    'smtp_username'::text,
    'smtp_password'::text,
    'whatsapp_access_token'::text,
    'whatsapp_verify_token'::text,
    'whatsapp_app_secret'::text
  ]));

create or replace function public.set_organization_secret(
  target_org uuid,
  target_key text,
  secret_value text,
  actor uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'vault'
as $$
declare
  v_name text;
  v_secret_id uuid;
begin
  if target_key not in (
    'holded_api_key',
    'openai_api_key',
    'fillout_webhook_secret',
    'booking_webhook_secret',
    'booking_api_key',
    'smtp_username',
    'smtp_password',
    'whatsapp_access_token',
    'whatsapp_verify_token',
    'whatsapp_app_secret'
  ) then
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

create index if not exists bookings_org_external_latest_idx
  on public.bookings (organization_id, external_booking_id, updated_at desc);
