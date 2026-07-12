-- Administrator-configurable webhook credentials for Fillout and Routsify Booking.
alter table public.organization_secrets
  drop constraint if exists organization_secrets_secret_key_check;

alter table public.organization_secrets
  add constraint organization_secrets_secret_key_check
  check (secret_key in ('holded_api_key', 'openai_api_key', 'fillout_webhook_secret', 'booking_webhook_secret'));

create or replace function public.set_organization_secret(target_org uuid, target_key text, secret_value text, actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  secret_id uuid;
  secret_name text;
begin
  if target_key not in ('holded_api_key', 'openai_api_key', 'fillout_webhook_secret', 'booking_webhook_secret')
     or length(coalesce(secret_value, '')) < 12 then
    raise exception 'invalid_secret';
  end if;

  secret_name := 'routsify:' || target_org::text || ':' || target_key;
  select vault_secret_id into secret_id
  from public.organization_secrets
  where organization_id = target_org and secret_key = target_key
  for update;

  if secret_id is null then
    select vault.create_secret(secret_value, secret_name, 'Routsify integration credential') into secret_id;
  else
    perform vault.update_secret(secret_id, secret_value, secret_name, 'Routsify integration credential');
  end if;

  insert into public.organization_secrets(organization_id, secret_key, vault_secret_id, updated_by, updated_at)
  values(target_org, target_key, secret_id, actor, now())
  on conflict(organization_id, secret_key)
  do update set vault_secret_id = excluded.vault_secret_id, updated_by = actor, updated_at = now();

  return jsonb_build_object('secret_key', target_key, 'configured', true, 'updated_at', now());
end;
$$;

revoke all on function public.set_organization_secret(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.set_organization_secret(uuid, text, text, uuid) to service_role;
