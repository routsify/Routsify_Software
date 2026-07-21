create or replace function public.organization_secret_status(target_org uuid)
returns table(secret_key text,configured boolean,updated_at timestamptz)
language sql security definer set search_path=public,vault as $$
  select keys.secret_key,(s.id is not null),s.updated_at
  from (values('holded_api_key'::text),('openai_api_key'::text)) keys(secret_key)
  left join vault.secrets s on s.name=format('routsify:%s:%s',target_org,keys.secret_key)
$$;
revoke all on function public.organization_secret_status(uuid) from public,anon,authenticated;
grant execute on function public.organization_secret_status(uuid) to service_role;

