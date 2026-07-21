alter table public.travelers add column if not exists document_type text;
alter table public.travelers add column if not exists issuing_country text;
alter table public.travelers add column if not exists mrz text;
alter table public.travelers add column if not exists ocr_status text not null default 'not_started';
alter table public.travelers add column if not exists ocr_confidence numeric(5,2);
alter table public.travelers add column if not exists reviewed_by uuid;
alter table public.travelers add column if not exists reviewed_at timestamptz;

alter table public.documents add column if not exists temporary boolean not null default false;
alter table public.documents add column if not exists purge_after timestamptz;
alter table public.documents add column if not exists purged_at timestamptz;
alter table public.documents add column if not exists scan_status text not null default 'pending';
alter table public.documents add column if not exists ocr_status text not null default 'not_started';

create table if not exists public.ocr_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  traveler_id uuid references public.travelers(id) on delete set null,
  provider text not null default 'manual',
  status text not null default 'queued',
  confidence_overall numeric(5,2),
  raw_payload_redacted jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.ocr_fields (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ocr_run_id uuid not null references public.ocr_runs(id) on delete cascade,
  field_name text not null,
  extracted_value text,
  corrected_value text,
  confidence numeric(5,2) not null default 0,
  review_status text not null default 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(ocr_run_id, field_name)
);

create or replace function public.mark_expired_sensitive_documents(target_org uuid, actor uuid default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_count integer:=0;
begin
  update public.documents
  set status='retention_due',updated_at=now()
  where organization_id=target_org
    and deleted_at is null
    and purged_at is null
    and sensitivity in ('private','sensitive')
    and coalesce(purge_after,retention_until::timestamptz)<=now()
    and status<>'retention_due';
  get diagnostics v_count=row_count;
  if v_count>0 then
    insert into public.audit_log(organization_id,actor_id,entity_type,action,after_data)
    values(target_org,actor,'documents', 'retention_review', jsonb_build_object('marked',v_count,'reviewed_at',now()));
  end if;
  return jsonb_build_object('marked',v_count);
end;
$$;

