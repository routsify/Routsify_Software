create or replace function public.ensure_proposal_terms_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('sent', 'accepted')
     and nullif(btrim(coalesce(new.terms_snapshot, '')), '') is null then
    new.terms_snapshot := 'La aceptación confirma la conformidad con los servicios, fechas e importes mostrados en esta versión. Routsify preparará el contrato, solicitará la documentación necesaria y coordinará los pagos y reservas correspondientes conforme a las condiciones contractuales aplicables.';
  end if;
  return new;
end;
$$;

drop trigger if exists proposal_versions_freeze_terms on public.proposal_versions;
create trigger proposal_versions_freeze_terms
before insert or update of status on public.proposal_versions
for each row execute function public.ensure_proposal_terms_snapshot();

