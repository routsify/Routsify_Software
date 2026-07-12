-- Manual Teya payment confirmation. Idempotent reference and one proforma for the full accepted trip.
create or replace function public.confirm_external_payment(
  target_org uuid,target_case uuid,transaction_value text,payment_reference_value text,
  amount_value numeric,currency_value text,provider_value text,confirmed_timestamp timestamptz,payment_payload jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_case public.cases%rowtype; v_payment public.payments%rowtype; v_document public.billing_documents%rowtype; v_key text; v_outbox uuid;
begin
  select * into v_case from public.cases where id=target_case and organization_id=target_org for update;
  if not found then raise exception 'case_not_found'; end if;
  if coalesce(v_case.accepted_value,0)<=0 then raise exception 'accepted_value_required'; end if;
  if coalesce(payment_reference_value,'')='' then raise exception 'payment_reference_required'; end if;
  insert into public.payments(organization_id,case_id,provider,provider_transaction_id,payment_reference,amount,currency,status,received_at,confirmed_at,payload,updated_at)
  values(target_org,target_case,coalesce(provider_value,'teya_manual'),transaction_value,payment_reference_value,amount_value,coalesce(currency_value,v_case.currency,'EUR'),'confirmed',confirmed_timestamp,confirmed_timestamp,coalesce(payment_payload,'{}'::jsonb),now())
  on conflict(organization_id,provider,payment_reference) do update set amount=excluded.amount,confirmed_at=excluded.confirmed_at,payload=excluded.payload,updated_at=now()
  returning * into v_payment;
  update public.cases set status='payment_confirmed',next_action='Sincronizar proforma y coordinar proveedores',billing_status='proforma_pending',updated_at=now() where id=target_case;
  v_key:='proforma:'||target_org::text||':'||target_case::text;
  insert into public.billing_documents(organization_id,case_id,client_id,document_type,type,trigger,trigger_name,amount,tax_amount,currency,status,sync_status,idempotency_key,sync_message,notes,updated_at)
  values(target_org,target_case,v_case.client_id,'proforma','proforma','payment_confirmed','payment_confirmed',v_case.accepted_value,0,coalesce(v_case.currency,'EUR'),'ready','pending',v_key,'Proforma total pendiente de Holded.','Creada al confirmar el pago.',now())
  on conflict(organization_id,idempotency_key) do update set amount=excluded.amount,currency=excluded.currency,updated_at=now()
  returning * into v_document;
  v_outbox:=public.enqueue_integration_event(target_org,'holded','proforma.create',v_key,jsonb_build_object('billing_document_id',v_document.id,'case_id',target_case,'client_id',v_case.client_id,'amount',v_case.accepted_value,'currency',v_case.currency),'low','Emitir proforma por el total al confirmar pago.','Crear proforma en Holded.');
  insert into public.timeline_events(organization_id,case_id,event_type,title,payload)
  values(target_org,target_case,'payment.confirmed','Pago confirmado',jsonb_build_object('payment_id',v_payment.id,'reference',payment_reference_value,'proforma_id',v_document.id));
  return jsonb_build_object('payment_id',v_payment.id,'case_id',target_case,'proforma_id',v_document.id,'outbox_id',v_outbox,'status','confirmed');
end;$$;
revoke all on function public.confirm_external_payment(uuid,uuid,text,text,numeric,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.confirm_external_payment(uuid,uuid,text,text,numeric,text,text,timestamptz,jsonb) to service_role;
