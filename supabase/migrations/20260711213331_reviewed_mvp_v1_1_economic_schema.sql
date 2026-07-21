create table if not exists public.formula_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  formula text not null default 'margin_on_sale' check (formula in ('margin_on_sale','markup_on_cost')),
  rounding_scale integer not null default 2 check (rounding_scale between 0 and 6),
  definition jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique(organization_id, code)
);

insert into public.formula_versions(organization_id, code, formula, rounding_scale, definition)
select id, 'margin-on-sale-v1', 'margin_on_sale', 2,
       jsonb_build_object('description','precio_venta = coste_presupuesto / (1 - margen)','version',1)
from public.organizations
on conflict (organization_id, code) do nothing;

alter table public.proposal_versions add column if not exists formula_version_id uuid references public.formula_versions(id) on delete restrict;
alter table public.proposal_versions add column if not exists margin_rules_snapshot_json jsonb not null default '{}'::jsonb;
alter table public.proposal_versions add column if not exists financial_summary_json jsonb not null default '{}'::jsonb;
alter table public.proposal_versions add column if not exists total_cost_real numeric(14,2) not null default 0;
alter table public.proposal_versions add column if not exists real_profit numeric(14,2) not null default 0;
alter table public.proposal_versions add column if not exists real_margin_pct numeric(9,6) not null default 0;
alter table public.proposal_versions add column if not exists cost_deviation numeric(14,2) not null default 0;
alter table public.proposal_versions add column if not exists updated_at timestamptz not null default now();

update public.proposal_versions pv
set formula_version_id=fv.id
from public.formula_versions fv
where pv.formula_version_id is null and fv.organization_id=pv.organization_id and fv.code='margin-on-sale-v1';

alter table public.budget_lines add column if not exists included boolean not null default true;
alter table public.budget_lines add column if not exists origin_margin text not null default 'global';
alter table public.budget_lines add column if not exists formula_version_id uuid references public.formula_versions(id) on delete restrict;
alter table public.budget_lines add column if not exists cost_real_source text;
alter table public.budget_lines add column if not exists cost_real_approved_at timestamptz;
alter table public.budget_lines add column if not exists cost_real_approved_by uuid;
alter table public.budget_lines add column if not exists manual_real_cost_reason text;
alter table public.budget_lines add column if not exists expected_purchase_id uuid;

update public.budget_lines bl
set formula_version_id=pv.formula_version_id
from public.proposal_versions pv
where bl.proposal_version_id=pv.id and bl.formula_version_id is null;

alter table public.expected_purchases add column if not exists provider_hash text;
alter table public.expected_purchases add column if not exists required boolean not null default true;
alter table public.expected_purchases add column if not exists active boolean not null default true;
alter table public.expected_purchases add column if not exists match_score numeric(5,2);
alter table public.expected_purchases add column if not exists match_checks jsonb not null default '[]'::jsonb;
alter table public.expected_purchases add column if not exists matched_by uuid;
alter table public.expected_purchases add column if not exists approved_cost numeric(14,2);
alter table public.expected_purchases add column if not exists requested_by uuid;
alter table public.expected_purchases add column if not exists cancelled_at timestamptz;
alter table public.expected_purchases add column if not exists cancellation_reason text;

create unique index if not exists expected_purchases_version_line_uidx
on public.expected_purchases(proposal_version_id,budget_line_id)
where budget_line_id is not null;

