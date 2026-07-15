-- Make selected business settings effective inside PostgreSQL, where the
-- protected transitions are actually enforced. Defaults preserve the current
-- production behaviour when an organization has not stored an override.

create or replace function public.routsify_setting_boolean(
  target_org uuid,
  target_key text,
  fallback boolean
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  raw_value jsonb;
  scalar_text text;
begin
  select rs.value
  into raw_value
  from public.routsify_settings rs
  where rs.organization_id = target_org
    and rs.key = target_key
  limit 1;

  if raw_value is null then
    return fallback;
  end if;

  if jsonb_typeof(raw_value) = 'object' and raw_value ? 'value' then
    raw_value := raw_value -> 'value';
  end if;

  if jsonb_typeof(raw_value) = 'boolean' then
    return (raw_value #>> '{}')::boolean;
  end if;

  if jsonb_typeof(raw_value) = 'number' then
    return coalesce((raw_value #>> '{}')::numeric, 0) <> 0;
  end if;

  if jsonb_typeof(raw_value) = 'string' then
    scalar_text := lower(btrim(raw_value #>> '{}'));
    if scalar_text in ('true', '1', 'yes', 'si', 'sí', 'on') then
      return true;
    end if;
    if scalar_text in ('false', '0', 'no', 'off') then
      return false;
    end if;
  end if;

  return fallback;
exception
  when others then
    return fallback;
end;
$$;

revoke all on function public.routsify_setting_boolean(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.routsify_setting_boolean(uuid, text, boolean) to service_role;

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
    if not public.routsify_setting_boolean(new.organization_id, 'purchases.auto_create', true) then
      return new;
    end if;

    accepted_version := new.current_version_id;
    if accepted_version is null then
      select id into accepted_version
      from public.proposal_versions
      where proposal_id = new.id
      order by version_number desc
      limit 1;
    end if;

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
      and line.included = true
      and line.creates_expected_purchase = true
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

create or replace function public.accept_proposal_version(target_version uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version public.proposal_versions%rowtype;
  v_proposal public.proposals%rowtype;
  v_now timestamptz := now();
  v_purchase_count integer := 0;
  v_auto_create_purchases boolean := true;
begin
  select * into v_version from public.proposal_versions where id = target_version for update;
  if not found then raise exception 'proposal_version_not_found'; end if;

  select * into v_proposal from public.proposals where id = v_version.proposal_id for update;
  if not found then raise exception 'proposal_not_found'; end if;

  if v_proposal.status = 'accepted' and v_proposal.current_version_id is distinct from target_version then
    raise exception 'accepted_proposal_locked';
  end if;

  v_auto_create_purchases := public.routsify_setting_boolean(v_version.organization_id, 'purchases.auto_create', true);

  perform public.recalculate_proposal_version_economics(target_version);
  select * into v_version from public.proposal_versions where id = target_version for update;

  if coalesce(v_version.total_sale, 0) <= 0 then raise exception 'proposal_total_required'; end if;
  if not exists(select 1 from public.budget_lines where proposal_version_id = target_version and included = true) then
    raise exception 'proposal_requires_included_lines';
  end if;

  update public.proposal_versions
  set status = 'accepted',
      accepted_at = coalesce(accepted_at, v_now),
      locked_at = coalesce(locked_at, v_now),
      locked = true,
      margin_rules_snapshot_json = coalesce((
        select jsonb_object_agg(stable_line_id, coalesce(margin_snapshot, '{}'::jsonb))
        from public.budget_lines
        where proposal_version_id = target_version
      ), '{}'::jsonb),
      snapshot = jsonb_build_object(
        'accepted_at', v_now,
        'formula_version_id', formula_version_id,
        'financial_summary', financial_summary_json,
        'line_count', (select count(*) from public.budget_lines where proposal_version_id = target_version and included = true),
        'purchases_auto_create', v_auto_create_purchases
      ),
      updated_at = v_now
  where id = target_version;

  update public.proposal_versions
  set status = 'expired', updated_at = v_now
  where proposal_id = v_proposal.id
    and id <> target_version
    and status in ('draft', 'sent', 'internal_review');

  update public.proposals
  set status = 'accepted',
      current_version_id = target_version,
      public_token_hash = null,
      public_token_expires_at = null,
      updated_at = v_now
  where id = v_proposal.id;

  update public.cases
  set status = 'proposal_accepted',
      accepted_value = v_version.total_sale,
      next_action = 'Solicitar datos de viajeros',
      blocker = null,
      last_activity_at = v_now,
      updated_at = v_now,
      last_event_at = v_now
  where id = v_proposal.case_id;

  if v_auto_create_purchases then
    update public.expected_purchases ep
    set status = 'cancelled',
        active = false,
        cancelled_at = v_now,
        cancellation_reason = 'La línea no forma parte del conjunto aceptado.',
        updated_at = v_now
    where ep.proposal_version_id = target_version
      and ep.budget_line_id in (
        select id
        from public.budget_lines
        where proposal_version_id = target_version
          and (included = false or creates_expected_purchase = false)
      )
      and ep.status not in ('approved', 'not_required', 'cancelled');

    insert into public.expected_purchases(
      organization_id,
      case_id,
      proposal_version_id,
      budget_line_id,
      supplier_id,
      supplier_name,
      provider_hash,
      service,
      expected_amount,
      amount,
      currency,
      status,
      required,
      active,
      review_notes
    )
    select
      line.organization_id,
      v_proposal.case_id,
      target_version,
      line.id,
      line.supplier_id,
      nullif(line.supplier_name, ''),
      encode(digest(lower(coalesce(nullif(line.supplier_name, ''), line.supplier_id::text, '')), 'sha256'), 'hex'),
      line.description_public,
      line.cost_budget,
      line.cost_budget,
      'EUR',
      'expected'::public.expected_purchase_status,
      true,
      true,
      'Generada automáticamente al aceptar la versión.'
    from public.budget_lines line
    where line.proposal_version_id = target_version
      and line.included = true
      and line.creates_expected_purchase = true
      and (line.supplier_id is not null or nullif(line.supplier_name, '') is not null or coalesce(line.cost_budget, 0) > 0)
    on conflict (proposal_version_id, budget_line_id) where budget_line_id is not null
    do update set
      supplier_id = excluded.supplier_id,
      supplier_name = excluded.supplier_name,
      provider_hash = excluded.provider_hash,
      service = excluded.service,
      expected_amount = excluded.expected_amount,
      amount = excluded.amount,
      required = true,
      active = true,
      status = case
        when public.expected_purchases.status = 'cancelled' then 'expected'::public.expected_purchase_status
        else public.expected_purchases.status
      end,
      updated_at = v_now;
    get diagnostics v_purchase_count = row_count;

    update public.budget_lines bl
    set expected_purchase_id = ep.id,
        updated_at = v_now
    from public.expected_purchases ep
    where bl.proposal_version_id = target_version
      and ep.proposal_version_id = target_version
      and ep.budget_line_id = bl.id;
  end if;

  insert into public.timeline_events(organization_id, case_id, event_type, title, payload)
  values(
    v_version.organization_id,
    v_proposal.case_id,
    'proposal.accepted',
    'Presupuesto aceptado',
    jsonb_build_object(
      'proposal_id', v_proposal.id,
      'version_id', target_version,
      'purchases_auto_create', v_auto_create_purchases,
      'expected_purchases_upserted', v_purchase_count
    )
  );

  insert into public.audit_log(organization_id, entity_type, entity_id, action, after_data)
  values(
    v_version.organization_id,
    'proposal_version',
    target_version,
    'accepted',
    jsonb_build_object(
      'proposal_id', v_proposal.id,
      'case_id', v_proposal.case_id,
      'purchases_auto_create', v_auto_create_purchases,
      'expected_purchases_upserted', v_purchase_count,
      'financial_summary', v_version.financial_summary_json
    )
  );

  return jsonb_build_object(
    'proposal_id', v_proposal.id,
    'version_id', target_version,
    'accepted_at', v_now,
    'purchases_auto_create', v_auto_create_purchases,
    'expected_purchases_created', v_purchase_count
  );
end;
$$;

create or replace function public.operational_close_preflight(target_case uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.cases%rowtype;
  v_org public.organizations%rowtype;
  blockers jsonb := '[]'::jsonb;
  pending_purchases integer := 0;
  integration_errors integer := 0;
  payment_total numeric := 0;
  ready boolean := false;
  earliest_close date;
  v_require_purchases boolean := true;
begin
  select * into v_case from public.cases where id = target_case for update;
  if not found then raise exception 'case_not_found'; end if;

  select * into v_org from public.organizations where id = v_case.organization_id;
  v_require_purchases := public.routsify_setting_boolean(v_case.organization_id, 'cases.close.requires_purchases', true);
  earliest_close := v_case.trip_end + coalesce(v_org.close_margin_days, 5);

  if v_case.trip_end is null then
    blockers := blockers || jsonb_build_array(jsonb_build_object('code', 'trip_end_missing', 'message', 'Falta la fecha de fin del viaje.'));
  elsif current_date < earliest_close then
    blockers := blockers || jsonb_build_array(jsonb_build_object('code', 'close_delay_not_reached', 'message', 'Todavía no se ha alcanzado el margen operativo tras el viaje.', 'available_at', earliest_close));
  end if;

  if not exists(
    select 1
    from public.proposals p
    join public.proposal_versions pv on pv.id = p.current_version_id
    where p.case_id = target_case
      and p.organization_id = v_case.organization_id
      and p.status = 'accepted'
      and pv.locked = true
  ) then
    blockers := blockers || jsonb_build_array(jsonb_build_object('code', 'accepted_budget_missing', 'message', 'No existe una versión aceptada y bloqueada.'));
  end if;

  if not exists(
    select 1 from public.contracts
    where organization_id = v_case.organization_id
      and case_id = target_case
      and status = 'signed'
  ) then
    blockers := blockers || jsonb_build_array(jsonb_build_object('code', 'contract_not_signed', 'message', 'El contrato no está firmado.'));
  end if;

  select coalesce(sum(amount), 0)
  into payment_total
  from public.payments
  where organization_id = v_case.organization_id
    and case_id = target_case
    and status = 'confirmed';

  if payment_total < coalesce(v_case.accepted_value, 0) then
    blockers := blockers || jsonb_build_array(jsonb_build_object('code', 'payment_incomplete', 'message', 'El pago confirmado no cubre la venta aceptada.', 'confirmed', payment_total, 'required', coalesce(v_case.accepted_value, 0)));
  end if;

  select count(*)
  into pending_purchases
  from public.expected_purchases
  where case_id = target_case
    and organization_id = v_case.organization_id
    and active = true
    and required = true
    and status not in ('approved', 'not_required', 'cancelled');

  if v_require_purchases and pending_purchases > 0 then
    blockers := blockers || jsonb_build_array(jsonb_build_object('code', 'supplier_purchases_pending', 'message', 'Hay compras o facturas de proveedor pendientes.', 'count', pending_purchases));
  end if;

  select count(*)
  into integration_errors
  from public.integration_outbox
  where related_case_id = target_case
    and organization_id = v_case.organization_id
    and status in ('failed', 'manual_review');

  if integration_errors > 0 then
    blockers := blockers || jsonb_build_array(jsonb_build_object('code', 'integration_errors', 'message', 'Hay errores o revisiones de integración pendientes.', 'count', integration_errors));
  end if;

  ready := jsonb_array_length(blockers) = 0;

  update public.cases
  set closure_check_at = now(),
      close_blockers = blockers,
      status = case when ready and status <> 'closed' then 'ready_to_close'::public.case_status else status end,
      next_action = case when ready then 'Emitir factura final y cerrar expediente' else next_action end,
      blocker = case when ready then null else 'Preflight de cierre con bloqueos pendientes' end,
      updated_at = now()
  where id = target_case;

  return jsonb_build_object(
    'ready', ready,
    'case_id', target_case,
    'blockers', blockers,
    'requires_purchases', v_require_purchases,
    'pending_purchases', pending_purchases,
    'integration_errors', integration_errors,
    'confirmed_payments', payment_total,
    'earliest_close', earliest_close
  );
end;
$$;

create or replace function public.protect_case_closure()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  close_days integer := 5;
  confirmed_total numeric := 0;
  pending_count integer := 0;
  v_require_purchases boolean := true;
begin
  if new.status = 'closed'::public.case_status and old.status is distinct from new.status then
    select coalesce(close_margin_days, 5)
    into close_days
    from public.organizations
    where id = new.organization_id;

    if new.trip_end is null or current_date < new.trip_end + close_days then
      raise exception 'case_close_delay_not_reached';
    end if;
    if new.billing_status <> 'final_invoice_issued' then
      raise exception 'final_invoice_not_issued';
    end if;
    if new.operational_closed_at is null or new.closed_at is null then
      raise exception 'operational_close_evidence_required';
    end if;
    if not exists(
      select 1
      from public.contracts c
      join public.signature_evidence se
        on se.contract_version_id = c.current_version_id
       and se.contract_id = c.id
      where c.organization_id = new.organization_id
        and c.case_id = new.id
        and c.status = 'signed'
    ) then
      raise exception 'signed_contract_evidence_required';
    end if;

    select coalesce(sum(amount), 0)
    into confirmed_total
    from public.payments
    where organization_id = new.organization_id
      and case_id = new.id
      and status = 'confirmed';

    if confirmed_total < coalesce(new.accepted_value, 0) then
      raise exception 'payment_incomplete';
    end if;

    v_require_purchases := public.routsify_setting_boolean(new.organization_id, 'cases.close.requires_purchases', true);
    if v_require_purchases then
      select count(*)
      into pending_count
      from public.expected_purchases
      where organization_id = new.organization_id
        and case_id = new.id
        and active = true
        and required = true
        and status not in ('approved', 'not_required', 'cancelled');

      if pending_count > 0 then
        raise exception 'supplier_purchases_pending';
      end if;
    end if;
  end if;
  return new;
end;
$$;
