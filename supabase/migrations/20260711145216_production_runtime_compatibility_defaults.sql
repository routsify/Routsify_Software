-- Compatibility defaults for the production app runtime.
-- Keeps the canonical schema but allows the current UI/API flows to create records safely.

alter table public.proposals
  add column if not exists status text not null default 'draft';

alter table public.proposals
  alter column title set default 'Propuesta Routsify';

alter table public.proposal_versions
  add column if not exists total_cost numeric not null default 0,
  add column if not exists snapshot jsonb not null default '{}'::jsonb,
  add column if not exists locked boolean not null default false,
  add column if not exists expires_at timestamptz;

alter table public.proposal_versions
  alter column title set default 'Versión 1',
  alter column narrative set default '{}'::jsonb,
  alter column margin_snapshot set default '{}'::jsonb,
  alter column total_cost_budget set default 0,
  alter column budgeted_profit set default 0;

alter table public.budget_lines
  alter column stable_line_id set default gen_random_uuid()::text,
  alter column creates_expected_purchase set default false,
  alter column sort_order set default 0;

alter table public.expected_purchases
  add column if not exists supplier_name text,
  add column if not exists service text,
  add column if not exists amount numeric,
  add column if not exists review_notes text;

alter table public.expected_purchases
  alter column case_id drop not null,
  alter column proposal_version_id drop not null,
  alter column budget_line_id drop not null;

alter type public.expected_purchase_status add value if not exists 'pending';
alter type public.expected_purchase_status add value if not exists 'received';
alter type public.expected_purchase_status add value if not exists 'review';

alter table public.documents
  alter column owner_id drop not null,
  alter column document_type set default 'general',
  alter column storage_bucket set default 'private-documents';

