-- Fix import_and_allocate_supplier_payment for unassigned Holded events.
-- Reversals and review-only imports may not have an expected_purchase_id.

create or replace function public.import_and_allocate_supplier_payment(
  target_organization_id uuid,
  target_expected_purchase_id uuid default null,
  payment_event jsonb default '{}'::jsonb,
  allocation_source text default 'auto',
  actor_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_event public.supplier_payment_events%rowtype;
  v_existing public.supplier_payment_events%rowtype;
  v_existing_found boolean := false;
  v_actor uuid;
  v_purchase_supplier_id uuid;
  v_purchase_case_id uuid;
  v_purchase_status text;
  v_purchase_currency text;
  v_purchase_expected numeric := 0;
  v_purchase_amount numeric := 0;
  v_purchase_invoice numeric := 0;
  v_purchase_approved numeric := 0;
  v_holded_payment_id text := nullif(payment_event->>'holded_payment_id', '');
  v_amount numeric := greatest(coalesce(nullif(payment_event->>'amount', '')::numeric, 0), 0);
  v_currency text := upper(coalesce(nullif(payment_event->>'currency', ''), 'EUR'));
  v_paid_at timestamptz := coalesce(nullif(payment_event->>'paid_at', '')::timestamptz, now());
  v_source text := coalesce(nullif(payment_event->>'source', ''), 'holded');
  v_status text := coalesce(nullif(payment_event->>'status', ''), 'unassigned');
  v_match_score numeric := nullif(payment_event->>'match_score', '')::numeric;
  v_payload_hash text := nullif(payment_event->>'source_payload_hash', '');
  v_payload jsonb := coalesce(payment_event->'source_payload', '{}'::jsonb);
  v_existing_alloc_purchase uuid;
  v_current_allocated numeric := 0;
  v_purchase_limit numeric := 0;
  v_allocation_id uuid;
begin
  if actor_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then v_actor := actor_id::uuid; end if;
  if v_amount <= 0 and v_status not in ('reversed', 'ignored') then return jsonb_build_object('ok', false, 'error', 'invalid_payment_amount'); end if;
  if v_currency !~ '^[A-Z]{3}$' then return jsonb_build_object('ok', false, 'error', 'invalid_currency'); end if;
  if v_source not in ('holded','manual','bank_import','adjustment') then return jsonb_build_object('ok', false, 'error', 'invalid_payment_source'); end if;
  if v_status not in ('unassigned','candidate','matched','review_needed','reversed','ignored') then v_status := 'review_needed'; end if;
  if allocation_source not in ('reference','auto','manual','import') then return jsonb_build_object('ok', false, 'error', 'invalid_allocation_source'); end if;

  if target_expected_purchase_id is not null then
    select supplier_id, case_id, status::text, currency, coalesce(expected_amount, 0), coalesce(amount, 0), coalesce(invoice_total, 0), coalesce(approved_cost, 0)
      into v_purchase_supplier_id, v_purchase_case_id, v_purchase_status, v_purchase_currency, v_purchase_expected, v_purchase_amount, v_purchase_invoice, v_purchase_approved
    from public.expected_purchases
    where id = target_expected_purchase_id and organization_id = target_organization_id
    for update;
    if not found then return jsonb_build_object('ok', false, 'error', 'purchase_not_found'); end if;
    if upper(coalesce(v_purchase_currency, 'EUR')) <> v_currency then v_status := 'review_needed'; target_expected_purchase_id := null; end if;
  end if;

  if v_holded_payment_id is not null then
    select * into v_existing from public.supplier_payment_events where organization_id = target_organization_id and holded_payment_id = v_holded_payment_id for update;
    v_existing_found := found;
  end if;

  if v_existing_found and v_existing.source_payload_hash is not null and v_payload_hash is not null and v_existing.source_payload_hash <> v_payload_hash then
    update public.supplier_payment_events set status = 'review_needed', source_payload_hash = v_payload_hash, source_payload = v_payload, updated_at = now() where id = v_existing.id returning * into v_event;
    insert into public.audit_log (organization_id, actor_id, entity_type, entity_id, action, before_data, after_data)
    values (target_organization_id, v_actor, 'supplier_payment_event', v_event.id, 'supplier_payment.payload_changed', to_jsonb(v_existing), jsonb_build_object('status', 'review_needed', 'source_payload_hash', v_payload_hash));
    return jsonb_build_object('ok', true, 'payment_event_id', v_event.id, 'status', 'review_needed', 'review_reason', 'payload_hash_changed');
  end if;

  if v_existing_found then
    update public.supplier_payment_events
    set supplier_id = coalesce(v_existing.supplier_id, v_purchase_supplier_id),
        case_id = coalesce(v_existing.case_id, v_purchase_case_id),
        holded_contact_id = coalesce(nullif(payment_event->>'holded_contact_id', ''), holded_contact_id),
        amount = v_amount,
        currency = v_currency,
        paid_at = v_paid_at,
        description = coalesce(nullif(left(coalesce(payment_event->>'description', ''), 500), ''), description),
        bank_id = coalesce(nullif(left(coalesce(payment_event->>'bank_id', ''), 120), ''), bank_id),
        payment_reference = coalesce(nullif(left(coalesce(payment_event->>'payment_reference', ''), 180), ''), payment_reference),
        source = v_source,
        status = case when status = 'matched' and target_expected_purchase_id is null then status else v_status end,
        match_score = coalesce(v_match_score, match_score),
        source_payload_hash = coalesce(v_payload_hash, source_payload_hash),
        source_payload = case when v_payload = '{}'::jsonb then source_payload else v_payload end,
        updated_at = now()
    where id = v_existing.id returning * into v_event;
  else
    insert into public.supplier_payment_events (organization_id, supplier_id, case_id, holded_payment_id, holded_contact_id, amount, currency, paid_at, description, bank_id, payment_reference, source, status, match_score, source_payload_hash, source_payload)
    values (target_organization_id, v_purchase_supplier_id, v_purchase_case_id, v_holded_payment_id, nullif(payment_event->>'holded_contact_id', ''), v_amount, v_currency, v_paid_at, nullif(left(coalesce(payment_event->>'description', ''), 500), ''), nullif(left(coalesce(payment_event->>'bank_id', ''), 120), ''), nullif(left(coalesce(payment_event->>'payment_reference', ''), 180), ''), v_source, v_status, v_match_score, v_payload_hash, v_payload)
    returning * into v_event;
  end if;

  if target_expected_purchase_id is null or v_status in ('reversed', 'ignored', 'review_needed') then
    return jsonb_build_object('ok', true, 'payment_event_id', v_event.id, 'status', v_status, 'allocated', false);
  end if;

  select expected_purchase_id into v_existing_alloc_purchase from public.supplier_payment_allocations where organization_id = target_organization_id and supplier_payment_event_id = v_event.id and expected_purchase_id <> target_expected_purchase_id limit 1;
  if v_existing_alloc_purchase is not null then
    update public.supplier_payment_events set status = 'review_needed', updated_at = now() where id = v_event.id;
    insert into public.audit_log (organization_id, actor_id, entity_type, entity_id, action, after_data) values (target_organization_id, v_actor, 'supplier_payment_event', v_event.id, 'supplier_payment.assignment_conflict', jsonb_build_object('existing_expected_purchase_id', v_existing_alloc_purchase, 'candidate_expected_purchase_id', target_expected_purchase_id));
    return jsonb_build_object('ok', true, 'payment_event_id', v_event.id, 'status', 'review_needed', 'allocated', false, 'review_reason', 'payment_already_allocated_to_other_purchase');
  end if;

  select coalesce(sum(spa.allocated_amount), 0) into v_current_allocated
  from public.supplier_payment_allocations spa join public.supplier_payment_events spe on spe.id = spa.supplier_payment_event_id
  where spa.organization_id = target_organization_id and spa.expected_purchase_id = target_expected_purchase_id and spa.supplier_payment_event_id <> v_event.id and spe.status not in ('reversed', 'ignored');

  v_purchase_limit := greatest(v_purchase_expected, v_purchase_amount, v_purchase_invoice, v_purchase_approved);
  if v_purchase_limit > 0 and v_current_allocated + v_amount > v_purchase_limit + 0.01 then
    update public.supplier_payment_events set status = 'review_needed', updated_at = now() where id = v_event.id;
    insert into public.audit_log (organization_id, actor_id, entity_type, entity_id, action, after_data) values (target_organization_id, v_actor, 'supplier_payment_event', v_event.id, 'supplier_payment.over_allocation_blocked', jsonb_build_object('expected_purchase_id', target_expected_purchase_id, 'current_allocated', v_current_allocated, 'incoming_amount', v_amount, 'limit', v_purchase_limit));
    return jsonb_build_object('ok', true, 'payment_event_id', v_event.id, 'status', 'review_needed', 'allocated', false, 'review_reason', 'allocation_exceeds_purchase_limit');
  end if;

  insert into public.supplier_payment_allocations (organization_id, supplier_payment_event_id, expected_purchase_id, allocated_amount, currency, allocation_source, match_score)
  values (target_organization_id, v_event.id, target_expected_purchase_id, v_amount, v_currency, allocation_source, v_match_score)
  on conflict (organization_id, supplier_payment_event_id, expected_purchase_id)
  do update set allocated_amount = excluded.allocated_amount, currency = excluded.currency, allocation_source = excluded.allocation_source, match_score = excluded.match_score, updated_at = now()
  returning id into v_allocation_id;

  update public.supplier_payment_events set status = 'matched', supplier_id = v_purchase_supplier_id, case_id = v_purchase_case_id, match_score = coalesce(v_match_score, 100), updated_at = now() where id = v_event.id returning * into v_event;
  update public.expected_purchases set status = case when status in ('expected','requested','uploaded','holded_candidate','review_needed') then 'matched' else status end, match_score = greatest(coalesce(match_score, 0), coalesce(v_match_score, 100)), matched_at = coalesce(matched_at, now()), last_synced_at = now(), sync_status = 'synced', sync_error = null, updated_at = now() where id = target_expected_purchase_id and organization_id = target_organization_id;

  insert into public.timeline_events (organization_id, case_id, event_type, title, payload, created_by)
  values (target_organization_id, v_purchase_case_id, 'supplier_payment.registered', case when v_source = 'holded' then 'Pago a proveedor importado desde Holded' else 'Pago a proveedor registrado' end, jsonb_build_object('expected_purchase_id', target_expected_purchase_id, 'supplier_payment_event_id', v_event.id, 'supplier_payment_allocation_id', v_allocation_id, 'amount', v_amount, 'currency', v_currency, 'paid_at', v_paid_at, 'source', v_source, 'reference', nullif(payment_event->>'payment_reference', ''), 'holded_payment_id', v_holded_payment_id), v_actor);
  insert into public.audit_log (organization_id, actor_id, entity_type, entity_id, action, after_data)
  values (target_organization_id, v_actor, 'supplier_payment_event', v_event.id, 'supplier_payment.imported_and_allocated', jsonb_build_object('expected_purchase_id', target_expected_purchase_id, 'allocation_id', v_allocation_id, 'amount', v_amount, 'currency', v_currency, 'source', v_source, 'holded_payment_id', v_holded_payment_id));

  return jsonb_build_object('ok', true, 'payment_event_id', v_event.id, 'allocation_id', v_allocation_id, 'status', 'matched', 'allocated', true);
end;
$$;

revoke all on function public.import_and_allocate_supplier_payment(uuid, uuid, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.import_and_allocate_supplier_payment(uuid, uuid, jsonb, text, text) to service_role;
