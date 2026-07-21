-- Lead review lifecycle and historical Fillout cleanup.
-- Historical records are archived, never deleted, and every status change is auditable.

alter table public.leads
  add column if not exists review_status text not null default 'pending',
  add column if not exists outcome text not null default 'open',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid,
  add column if not exists review_note text,
  add column if not exists archived_at timestamptz;

do $$
begin
  alter table public.leads
    add constraint leads_review_status_check
    check (review_status in ('pending', 'reviewed'));
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.leads
    add constraint leads_outcome_check
    check (outcome in ('open', 'won', 'lost', 'unknown'));
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.leads
    add constraint leads_reviewed_by_fkey
    foreign key (reviewed_by) references public.profiles(user_id) on delete set null;
exception
  when duplicate_object then null;
end
$$;

create index if not exists leads_review_queue_idx
  on public.leads (organization_id, review_status, updated_at desc);

create index if not exists leads_outcome_idx
  on public.leads (organization_id, outcome, updated_at desc);

-- Record the exact before/after state before classifying the imported backlog.
insert into public.audit_log (
  organization_id,
  actor_id,
  action,
  entity_type,
  entity_id,
  before_data,
  after_data
)
select
  l.organization_id,
  null,
  'historical_fillout_review',
  'lead',
  l.id,
  jsonb_build_object(
    'status', l.status,
    'review_status', l.review_status,
    'outcome', l.outcome,
    'archived_at', l.archived_at
  ),
  jsonb_build_object(
    'status',
      case
        when exists (
          select 1
          from public.cases c
          join public.proposals p on p.case_id = c.id
          join public.proposal_versions pv on pv.proposal_id = p.id
          where c.client_id = l.client_id and pv.status = 'accepted'
        ) or exists (
          select 1
          from public.cases c
          join public.payments pay on pay.case_id = c.id
          where c.client_id = l.client_id and pay.status = 'confirmed'
        ) then 'won'
        when exists (select 1 from public.cases c where c.lead_id = l.id) then 'converted'
        else 'archived'
      end,
    'review_status', 'reviewed',
    'outcome',
      case
        when exists (
          select 1
          from public.cases c
          join public.proposals p on p.case_id = c.id
          join public.proposal_versions pv on pv.proposal_id = p.id
          where c.client_id = l.client_id and pv.status = 'accepted'
        ) or exists (
          select 1
          from public.cases c
          join public.payments pay on pay.case_id = c.id
          where c.client_id = l.client_id and pay.status = 'confirmed'
        ) then 'won'
        when exists (select 1 from public.cases c where c.lead_id = l.id) then 'open'
        else 'unknown'
      end,
    'cleanup_reason', 'historical_fillout_backlog'
  )
from public.leads l
where lower(l.source) = 'fillout'
  and l.review_status = 'pending';

update public.leads l
set
  status = case
    when exists (
      select 1
      from public.cases c
      join public.proposals p on p.case_id = c.id
      join public.proposal_versions pv on pv.proposal_id = p.id
      where c.client_id = l.client_id and pv.status = 'accepted'
    ) or exists (
      select 1
      from public.cases c
      join public.payments pay on pay.case_id = c.id
      where c.client_id = l.client_id and pay.status = 'confirmed'
    ) then 'won'
    when exists (select 1 from public.cases c where c.lead_id = l.id) then 'converted'
    else 'archived'
  end,
  review_status = 'reviewed',
  outcome = case
    when exists (
      select 1
      from public.cases c
      join public.proposals p on p.case_id = c.id
      join public.proposal_versions pv on pv.proposal_id = p.id
      where c.client_id = l.client_id and pv.status = 'accepted'
    ) or exists (
      select 1
      from public.cases c
      join public.payments pay on pay.case_id = c.id
      where c.client_id = l.client_id and pay.status = 'confirmed'
    ) then 'won'
    when exists (select 1 from public.cases c where c.lead_id = l.id) then 'open'
    else 'unknown'
  end,
  reviewed_at = now(),
  reviewed_by = null,
  review_note = case
    when exists (
      select 1
      from public.cases c
      join public.proposals p on p.case_id = c.id
      join public.proposal_versions pv on pv.proposal_id = p.id
      where c.client_id = l.client_id and pv.status = 'accepted'
    ) or exists (
      select 1
      from public.cases c
      join public.payments pay on pay.case_id = c.id
      where c.client_id = l.client_id and pay.status = 'confirmed'
    ) then 'Compra confirmada mediante evidencia económica registrada.'
    when exists (select 1 from public.cases c where c.lead_id = l.id)
      then 'Convertido a expediente; resultado comercial todavía abierto.'
    else 'Solicitud histórica revisada y archivada; compra no verificable con los datos disponibles.'
  end,
  archived_at = case
    when exists (select 1 from public.cases c where c.lead_id = l.id)
      or exists (
        select 1
        from public.cases c
        join public.proposals p on p.case_id = c.id
        join public.proposal_versions pv on pv.proposal_id = p.id
        where c.client_id = l.client_id and pv.status = 'accepted'
      )
      or exists (
        select 1
        from public.cases c
        join public.payments pay on pay.case_id = c.id
        where c.client_id = l.client_id and pay.status = 'confirmed'
      )
      then null
    else now()
  end,
  updated_at = now()
where lower(l.source) = 'fillout'
  and l.review_status = 'pending';

insert into public.audit_log (
  organization_id,
  actor_id,
  action,
  entity_type,
  entity_id,
  before_data,
  after_data
)
select
  t.organization_id,
  null,
  'historical_fillout_task_cleanup',
  'task',
  t.id,
  jsonb_build_object('status', t.status, 'due_at', t.due_at),
  jsonb_build_object('status', 'cancelled', 'cleanup_reason', 'historical_fillout_backlog')
from public.tasks t
where t.status in ('pending', 'in_progress')
  and t.idempotency_key like 'lead_followup:%'
  and exists (
    select 1
    from public.leads l
    where l.client_id = t.client_id
      and lower(l.source) = 'fillout'
      and l.review_status = 'reviewed'
  );

update public.tasks t
set
  status = 'cancelled',
  blocker = null,
  payload = t.payload || jsonb_build_object(
    'cleanup_reason', 'historical_fillout_backlog',
    'cancelled_at', now()
  ),
  updated_at = now()
where t.status in ('pending', 'in_progress')
  and t.idempotency_key like 'lead_followup:%'
  and exists (
    select 1
    from public.leads l
    where l.client_id = t.client_id
      and lower(l.source) = 'fillout'
      and l.review_status = 'reviewed'
  );

-- Foreign-key indexes must begin with the referenced column to help deletes and joins.
create index if not exists proposal_scenarios_proposal_id_idx
  on public.proposal_scenarios (proposal_id);

create index if not exists supplier_incidents_case_id_idx
  on public.supplier_incidents (case_id);

create index if not exists supplier_incidents_supplier_id_idx
  on public.supplier_incidents (supplier_id);

create index if not exists supplier_services_supplier_id_idx
  on public.supplier_services (supplier_id);

-- Use the same conservative upload policy for every private operational bucket.
update storage.buckets
set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
where id in ('case-documents', 'invoices', 'proposal-assets', 'travel-documents');

