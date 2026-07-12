-- OpenAI OCR run/field audit model and sensitive-role access.
create table if not exists public.ocr_runs(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  traveler_id uuid references public.travelers(id) on delete set null,
  provider text not null default 'openai', model text,
  status text not null default 'processing', confidence_overall numeric(5,4),
  raw_payload_redacted jsonb not null default '{}'::jsonb, error text,
  created_by uuid, reviewed_by uuid, started_at timestamptz default now(),
  completed_at timestamptz, reviewed_at timestamptz
);
create table if not exists public.ocr_fields(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ocr_run_id uuid not null references public.ocr_runs(id) on delete cascade,
  field_name text not null, extracted_value text, corrected_value text,
  confidence numeric(5,4), review_status text not null default 'pending',
  reviewed_by uuid, reviewed_at timestamptz,
  unique(ocr_run_id,field_name)
);
alter table public.ocr_runs enable row level security;
alter table public.ocr_fields enable row level security;
drop policy if exists ocr_runs_sensitive_access on public.ocr_runs;
drop policy if exists ocr_fields_sensitive_access on public.ocr_fields;
create policy ocr_runs_sensitive_access on public.ocr_runs for all
  using(organization_id=public.current_org_id() and public.current_app_role() in('admin','sales'))
  with check(organization_id=public.current_org_id() and public.current_app_role() in('admin','sales'));
create policy ocr_fields_sensitive_access on public.ocr_fields for all
  using(organization_id=public.current_org_id() and public.current_app_role() in('admin','sales'))
  with check(organization_id=public.current_org_id() and public.current_app_role() in('admin','sales'));
