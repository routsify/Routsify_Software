create or replace function public.current_organization_id()
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.has_org_access(target_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select target_org = public.current_organization_id();
$$;

create or replace function public.has_role(allowed text[])
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() = any(allowed);
$$;

create or replace function public.accept_proposal_version(target_version uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_case uuid;
  v_total numeric(12,2);
  v_proposal uuid;
begin
  select pv.organization_id, p.case_id, pv.total_sale, pv.proposal_id
  into v_org, v_case, v_total, v_proposal
  from public.proposal_versions pv
  join public.proposals p on p.id = pv.proposal_id
  where pv.id = target_version;

  if v_org is null then
    raise exception 'proposal_version_not_found';
  end if;

  update public.proposal_versions
  set status = case when id = target_version then 'accepted' else 'expired' end,
      locked = true,
      accepted_at = case when id = target_version then now() else accepted_at end
  where proposal_id = v_proposal and status in ('draft','sent','internal_review');

  update public.cases
  set status = 'proposal_accepted', accepted_value = v_total, updated_at = now()
  where id = v_case;
end;
$$;

create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  row_org uuid;
  row_id uuid;
begin
  if tg_op = 'DELETE' then
    row_org := old.organization_id;
    row_id := old.id;
  else
    row_org := new.organization_id;
    row_id := new.id;
  end if;

  insert into public.audit_log(organization_id, actor_id, entity_type, entity_id, action, before_data, after_data)
  values (
    row_org,
    auth.uid(),
    tg_table_name,
    row_id,
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['clients','leads','bookings','cases','proposals','proposal_versions','budget_lines','expected_purchases','supplier_invoices','suppliers','travelers','documents','contracts','payments','billing_documents','integration_outbox'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop trigger if exists %I_audit on public.%I', t, t);
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row_change()', t, t);
  end loop;
end $$;

alter table public.audit_log enable row level security;
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;

drop policy if exists organizations_select on public.organizations;
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists audit_select on public.audit_log;

create policy organizations_select on public.organizations for select using (id = public.current_organization_id());
create policy profiles_select on public.profiles for select using (organization_id = public.current_organization_id());
create policy profiles_update_self on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy audit_select on public.audit_log for select using (public.has_org_access(organization_id) and public.has_role(array['admin','direction']));

do $$
declare
  t text;
begin
  foreach t in array array['clients','leads','bookings','cases','proposals','proposal_versions','budget_lines','expected_purchases','supplier_invoices','suppliers','travelers','documents','contracts','payments','billing_documents','integration_outbox'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select using (public.has_org_access(organization_id))', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (public.has_org_access(organization_id) and public.has_role(array[''admin'',''direction'',''sales'',''operations'',''billing'']))', t, t);
    execute format('create policy %I_update on public.%I for update using (public.has_org_access(organization_id) and public.has_role(array[''admin'',''direction'',''sales'',''operations'',''billing''])) with check (public.has_org_access(organization_id))', t, t);
    execute format('create policy %I_delete on public.%I for delete using (public.has_org_access(organization_id) and public.has_role(array[''admin'',''direction'']))', t, t);
  end loop;
end $$;

insert into storage.buckets (id, name, public)
values ('case-documents','case-documents',false), ('proposal-public-assets','proposal-public-assets',true)
on conflict (id) do nothing;

drop policy if exists case_documents_read on storage.objects;
drop policy if exists case_documents_write on storage.objects;
drop policy if exists proposal_assets_public_read on storage.objects;

create policy case_documents_read on storage.objects for select using (
  bucket_id = 'case-documents'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.organization_id::text = (storage.foldername(name))[1])
);

create policy case_documents_write on storage.objects for insert with check (
  bucket_id = 'case-documents'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.organization_id::text = (storage.foldername(name))[1])
);

create policy proposal_assets_public_read on storage.objects for select using (bucket_id = 'proposal-public-assets');
