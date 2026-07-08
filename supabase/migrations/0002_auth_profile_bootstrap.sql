create or replace function public.ensure_profile_for_current_user()
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_org_id uuid;
  new_role public.app_role;
  result_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select id into target_org_id
  from public.organizations
  where slug = coalesce(auth.jwt() ->> 'org_slug', 'routsify-demo')
  limit 1;

  if target_org_id is null then
    raise exception 'organization_not_found';
  end if;

  select p.* into result_profile
  from public.profiles p
  where p.user_id = auth.uid();

  if result_profile.user_id is not null then
    return result_profile;
  end if;

  if not exists (select 1 from public.profiles where organization_id = target_org_id) then
    new_role := 'admin'::public.app_role;
  else
    new_role := 'viewer'::public.app_role;
  end if;

  insert into public.profiles (user_id, organization_id, full_name, role)
  values (
    auth.uid(),
    target_org_id,
    coalesce(auth.jwt() ->> 'full_name', auth.jwt() ->> 'email'),
    new_role
  )
  returning * into result_profile;

  return result_profile;
end;
$$;

revoke all on function public.ensure_profile_for_current_user() from public;
grant execute on function public.ensure_profile_for_current_user() to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_org_id uuid;
  new_role public.app_role;
begin
  select id into target_org_id
  from public.organizations
  where slug = coalesce(new.raw_user_meta_data ->> 'org_slug', 'routsify-demo')
  limit 1;

  if target_org_id is null then
    return new;
  end if;

  if not exists (select 1 from public.profiles where organization_id = target_org_id) then
    new_role := 'admin'::public.app_role;
  else
    new_role := 'viewer'::public.app_role;
  end if;

  insert into public.profiles (user_id, organization_id, full_name, role)
  values (
    new.id,
    target_org_id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new_role
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();
