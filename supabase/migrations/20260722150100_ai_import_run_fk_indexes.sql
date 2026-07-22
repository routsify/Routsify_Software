create index if not exists ai_import_runs_case_idx
  on public.ai_import_runs (case_id);

create index if not exists ai_import_runs_proposal_idx
  on public.ai_import_runs (proposal_id);
