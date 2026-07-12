-- Organization-scoped integration credentials stored in Supabase Vault.
create extension if not exists supabase_vault with schema vault;
create table if not exists public.organization_secrets(
  organization_id uuid not null references public.organizations(id) on delete cascade,
  secret_key text not null check(secret_key in('holded_api_key','openai_api_key')),
  vault_secret_id uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(organization_id,secret_key)
);
alter table public.organization_secrets enable row level security;
drop policy if exists organization_secrets_deny_client on public.organization_secrets;
create policy organization_secrets_deny_client on public.organization_secrets for all using(false) with check(false);

create or replace function public.set_organization_secret(target_org uuid,target_key text,secret_value text,actor uuid)
returns jsonb language plpgsql security definer set search_path=public,vault as $$
declare secret_id uuid; secret_name text;
begin
  if target_key not in('holded_api_key','openai_api_key') or length(coalesce(secret_value,''))<12 then raise exception 'invalid_secret'; end if;
  secret_name:='routsify:'||target_org::text||':'||target_key;
  select vault_secret_id into secret_id from public.organization_secrets where organization_id=target_org and secret_key=target_key for update;
  if secret_id is null then select vault.create_secret(secret_value,secret_name,'Routsify integration credential') into secret_id;
  else perform vault.update_secret(secret_id,secret_value,secret_name,'Routsify integration credential'); end if;
  insert into public.organization_secrets(organization_id,secret_key,vault_secret_id,updated_by,updated_at)
  values(target_org,target_key,secret_id,actor,now()) on conflict(organization_id,secret_key)
  do update set vault_secret_id=excluded.vault_secret_id,updated_by=actor,updated_at=now();
  return jsonb_build_object('secret_key',target_key,'configured',true,'updated_at',now());
end;$$;

create or replace function public.get_organization_secret(target_org uuid,target_key text)
returns text language sql stable security definer set search_path=public,vault as $$
  select ds.decrypted_secret from public.organization_secrets os join vault.decrypted_secrets ds on ds.id=os.vault_secret_id
  where os.organization_id=target_org and os.secret_key=target_key;
$$;

create or replace function public.delete_organization_secret(target_org uuid,target_key text,actor uuid)
returns jsonb language plpgsql security definer set search_path=public,vault as $$
declare secret_id uuid;
begin
  select vault_secret_id into secret_id from public.organization_secrets where organization_id=target_org and secret_key=target_key for update;
  delete from public.organization_secrets where organization_id=target_org and secret_key=target_key;
  if secret_id is not null then delete from vault.secrets where id=secret_id; end if;
  return jsonb_build_object('secret_key',target_key,'configured',false);
end;$$;
revoke all on function public.set_organization_secret(uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.get_organization_secret(uuid,text) from public,anon,authenticated;
revoke all on function public.delete_organization_secret(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.set_organization_secret(uuid,text,text,uuid) to service_role;
grant execute on function public.get_organization_secret(uuid,text) to service_role;
grant execute on function public.delete_organization_secret(uuid,text,uuid) to service_role;
