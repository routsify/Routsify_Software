-- Product simplification: remove internal proposal scenarios, distinguish supplier
-- display/fiscal names, add organization branding storage, and allow safe deletion
-- of proposals that were sent but never accepted.

alter table public.suppliers add column if not exists fiscal_name text;

update public.suppliers
set fiscal_name = name
where fiscal_name is null or btrim(fiscal_name) = '';

alter table public.suppliers alter column fiscal_name set not null;

do $$ begin
  alter table public.suppliers add constraint suppliers_fiscal_name_length_check
    check (length(btrim(fiscal_name)) between 2 and 180);
exception when duplicate_object then null; end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-assets', 'brand-assets', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop function if exists public.apply_proposal_scenario(uuid, uuid, uuid);
drop table if exists public.proposal_scenarios cascade;

create or replace function public.delete_unaccepted_proposal(
  target_org uuid,
  target_proposal uuid,
  actor uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  proposal_row public.proposals;
  protected_count integer := 0;
  version_ids uuid[] := array[]::uuid[];
  now_value timestamptz := now();
begin
  select * into proposal_row
  from public.proposals
  where id = target_proposal and organization_id = target_org
  for update;

  if proposal_row.id is null then raise exception 'proposal_not_found'; end if;
  if proposal_row.status = 'accepted' then raise exception 'accepted_proposal_cannot_be_deleted'; end if;

  select coalesce(array_agg(id), array[]::uuid[]) into version_ids
  from public.proposal_versions
  where proposal_id = target_proposal and organization_id = target_org;

  select count(*) into protected_count
  from public.proposal_acceptances
  where organization_id = target_org and proposal_id = target_proposal;

  if protected_count = 0 and cardinality(version_ids) > 0 then
    select
      (select count(*) from public.contracts where organization_id = target_org and proposal_version_id = any(version_ids))
      + (select count(*) from public.contract_versions where organization_id = target_org and proposal_version_id = any(version_ids))
      + (select count(*) from public.signature_evidence where organization_id = target_org and proposal_version_id = any(version_ids))
      + (select count(*) from public.expected_purchases where organization_id = target_org and proposal_version_id = any(version_ids))
    into protected_count;
  end if;

  if protected_count > 0 then raise exception 'proposal_has_accepted_history'; end if;

  delete from public.communication_followups
  where organization_id = target_org and proposal_id = target_proposal;

  delete from public.integration_outbox
  where organization_id = target_org
    and (
      entity_id = target_proposal
      or entity_id = any(version_ids)
      or payload->>'proposal_id' = target_proposal::text
      or payload->>'proposal_version_id' in (select unnest(version_ids)::text)
    );

  delete from public.proposals
  where id = target_proposal and organization_id = target_org;

  update public.cases
  set status = 'call_done', next_action = 'Preparar nuevo presupuesto', updated_at = now_value
  where id = proposal_row.case_id
    and organization_id = target_org
    and status in ('budget_draft', 'proposal_sent');

  insert into public.audit_log(organization_id, actor_id, entity_type, entity_id, action, before_data, after_data)
  values (
    target_org,
    actor,
    'proposal',
    target_proposal,
    'proposal.deleted',
    to_jsonb(proposal_row),
    jsonb_build_object('client_access_revoked', proposal_row.status = 'sent', 'deleted_at', now_value)
  );

  return jsonb_build_object('id', target_proposal, 'previous_status', proposal_row.status, 'client_access_revoked', proposal_row.status = 'sent');
end;
$$;

revoke all on function public.delete_unaccepted_proposal(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_unaccepted_proposal(uuid, uuid, uuid) to service_role;
