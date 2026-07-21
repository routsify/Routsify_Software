create or replace function public.protect_accepted_proposal_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'accepted' and new.status <> 'accepted' then
    raise exception 'accepted_proposal_locked';
  end if;
  return new;
end;
$$;

drop trigger if exists proposals_protect_accepted_status on public.proposals;
create trigger proposals_protect_accepted_status
before update of status on public.proposals
for each row execute function public.protect_accepted_proposal_status();

create or replace function public.generate_expected_purchases_after_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted_version uuid;
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    select id into accepted_version
    from public.proposal_versions
    where proposal_id = new.id
    order by version_number desc
    limit 1;

    insert into public.expected_purchases (
      organization_id,
      case_id,
      proposal_version_id,
      budget_line_id,
      supplier_id,
      supplier_name,
      service,
      expected_amount,
      amount,
      currency,
      status
    )
    select
      new.organization_id,
      new.case_id,
      accepted_version,
      line.id,
      line.supplier_id,
      line.supplier_name,
      line.description_public,
      line.cost_budget,
      line.cost_budget,
      'EUR',
      'expected'::public.expected_purchase_status
    from public.budget_lines line
    where line.proposal_version_id = accepted_version
      and line.cost_budget > 0
      and not exists (
        select 1
        from public.expected_purchases purchase
        where purchase.organization_id = new.organization_id
          and purchase.budget_line_id = line.id
      );
  end if;
  return new;
end;
$$;

drop trigger if exists proposals_generate_expected_purchases on public.proposals;
create trigger proposals_generate_expected_purchases
after update of status on public.proposals
for each row execute function public.generate_expected_purchases_after_acceptance();

