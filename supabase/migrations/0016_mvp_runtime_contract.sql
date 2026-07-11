-- Routsify MVP runtime contract: aligns the deployed Supabase schema with the reviewed Next.js application.

create extension if not exists pgcrypto;

alter table public.leads add column if not exists client_name text;
alter table public.leads add column if not exists email text;
alter table public.leads add column if not exists email_normalized text;
alter table public.leads add column if not exists phone text;
alter table public.leads add column if not exists phone_normalized text;
alter table public.leads add column if not exists travelers integer not null default 1;
alter table public.leads add column if not exists possible_duplicate_client_id uuid references public.clients(id) on delete set null;
alter table public.leads add column if not exists updated_at timestamptz not null default now();

alter table public.bookings add column if not exists possible_duplicate_client_id uuid references public.clients(id) on delete set null;
alter table public.bookings add column if not exists external_id text;
alter table public.bookings add column if not exists source text not null default 'booking';
alter table public.bookings add column if not exists event_timestamp timestamptz not null default now();
alter table public.bookings add column if not exists updated_at timestamptz not null default now();
update public.bookings set external_id = coalesce(external_id, external_booking_id) where external_id is null;
do $$ begin
  alter table public.bookings drop constraint if exists bookings_organization_id_external_booking_id_event_type_key;
exception when undefined_object then null; end $$;
create unique index if not exists bookings_event_idempotency_idx on public.bookings(organization_id, source, external_booking_id, event_type, event_timestamp);

alter table public.cases add column if not exists final_notes text;
alter table public.cases add column if not exists closed_at timestamptz;
alter table public.cases add column if not exists operational_closed_at timestamptz;
alter table public.cases add column if not exists closure_check_at timestamptz;
alter table public.cases add column if not exists close_blockers jsonb not null default '[]'::jsonb;

create table if not exists public.margin_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null default 'Regla de margen',
  supplier_id uuid references public.suppliers(id) on delete cascade,
  service_type_code text,
  destination text,
  formula text not null default 'margin_on_sale' check (formula in ('margin_on_sale','markup_on_cost')),
  minimum_margin numeric(8,4) not null default 12,
  priority integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.budget_lines add column if not exists margin_rule_id uuid references public.margin_rules(id) on delete set null;
alter table public.budget_lines add column if not exists margin_snapshot jsonb not null default '{}'::jsonb;
alter table public.budget_lines add column if not exists updated_at timestamptz not null default now();

alter table public.expected_purchases add column if not exists requested_at timestamptz;
alter table public.expected_purchases add column if not exists uploaded_at timestamptz;
alter table public.expected_purchases add column if not exists matched_at timestamptz;
alter table public.expected_purchases add column if not exists not_required_at timestamptz;
alter table public.expected_purchases add column if not exists not_required_by uuid;
alter table public.expected_purchases add column if not exists approved_at timestamptz;
alter table public.expected_purchases add column if not exists approved_by uuid;
alter table public.expected_purchases add column if not exists holded_purchase_id text;
alter table public.expected_purchases add column if not exists sync_status text not null default 'pending';
alter table public.expected_purchases add column if not exists sync_error text;
alter table public.expected_purchases add column if not exists last_synced_at timestamptz;
alter table public.expected_purchases add column if not exists invoice_number text;
alter table public.expected_purchases add column if not exists invoice_date date;
alter table public.expected_purchases add column if not exists invoice_base numeric(12,2);
alter table public.expected_purchases add column if not exists invoice_tax numeric(12,2);
alter table public.expected_purchases add column if not exists invoice_total numeric(12,2);

alter table public.supplier_invoices add column if not exists status text not null default 'reviewing';
alter table public.supplier_invoices add column if not exists file_name text;
alter table public.supplier_invoices add column if not exists mime_type text;
alter table public.supplier_invoices add column if not exists size_bytes bigint;
alter table public.supplier_invoices add column if not exists checksum text;
alter table public.supplier_invoices add column if not exists uploaded_at timestamptz not null default now();
alter table public.supplier_invoices add column if not exists reviewed_by uuid;
alter table public.supplier_invoices add column if not exists approved_by uuid;
alter table public.supplier_invoices add column if not exists updated_at timestamptz not null default now();
alter table public.supplier_invoices add column if not exists total numeric(12,2) generated always as (total_amount) stored;
drop index if exists public.supplier_invoices_storage_path_idx;
create unique index supplier_invoices_storage_path_idx on public.supplier_invoices(organization_id, storage_path);

alter table public.documents add column if not exists bucket text;
alter table public.documents add column if not exists uploaded_at timestamptz not null default now();
alter table public.documents add column if not exists deleted_at timestamptz;
alter table public.documents add column if not exists updated_at timestamptz not null default now();
update public.documents set bucket = storage_bucket where bucket is null;
create unique index if not exists documents_storage_path_idx on public.documents(organization_id, storage_path);
create or replace function public.sync_document_bucket_columns()
returns trigger language plpgsql set search_path=public as $$
begin
  new.storage_bucket := coalesce(nullif(new.bucket,''), nullif(new.storage_bucket,''), 'case-documents');
  new.bucket := new.storage_bucket;
  return new;
end;
$$;
drop trigger if exists trg_sync_document_bucket_columns on public.documents;
create trigger trg_sync_document_bucket_columns before insert or update of bucket, storage_bucket on public.documents
for each row execute function public.sync_document_bucket_columns();

alter table public.document_access_log add column if not exists expires_at timestamptz;
alter table public.document_access_log add column if not exists user_agent text;

alter table public.payments add column if not exists transaction_id text;
alter table public.payments add column if not exists idempotency_key text;
alter table public.payments add column if not exists received_at timestamptz;
alter table public.payments add column if not exists reference text;
alter table public.payments add column if not exists updated_at timestamptz not null default now();
update public.payments set transaction_id=coalesce(transaction_id,payment_reference),idempotency_key=coalesce(idempotency_key,payment_reference),reference=coalesce(reference,payment_reference),received_at=coalesce(received_at,confirmed_at,created_at)
where transaction_id is null or idempotency_key is null or reference is null or received_at is null;
create unique index if not exists payments_transaction_id_idx on public.payments(organization_id, transaction_id) where transaction_id is not null;

alter table public.integration_outbox add column if not exists next_attempt_at timestamptz;
alter table public.integration_outbox add column if not exists locked_at timestamptz;
alter table public.integration_outbox add column if not exists locked_by text;
alter table public.integration_outbox add column if not exists processed_at timestamptz;
create index if not exists integration_outbox_claim_idx on public.integration_outbox(status, next_attempt_at, created_at);

alter table public.tasks add column if not exists blocker text;
alter table public.tasks add column if not exists idempotency_key text;
drop index if exists public.tasks_org_idempotency_idx;
create unique index tasks_org_idempotency_idx on public.tasks(organization_id, idempotency_key);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel text not null,
  event_id text not null,
  event_type text not null,
  payload_hash text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received',
  last_error text,
  unique(organization_id, channel, event_id, event_type)
);

do $$
declare tbl text;
begin
  foreach tbl in array array['leads','bookings','suppliers','supplier_invoices','travelers','contracts','billing_documents','tasks','timeline_events','margin_rules','proposal_acceptances','webhook_events'] loop
    execute format('alter table public.%I enable row level security', tbl);
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=tbl and policyname=tbl || '_org_access') then
      execute format('create policy %I on public.%I for all using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id())', tbl || '_org_access', tbl);
    end if;
  end loop;
end $$;

create or replace function public.enqueue_integration_event(target_org uuid, channel_name text, event_name text, idem_key text, event_payload jsonb, event_risk text default 'low', rule text default null, action text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare result_id uuid;
begin
  if target_org is null or nullif(channel_name,'') is null or nullif(event_name,'') is null or nullif(idem_key,'') is null then raise exception 'invalid_integration_event'; end if;
  insert into public.integration_outbox(organization_id,provider,channel,event_type,entity_type,idempotency_key,payload,sync_status,status,risk,business_rule,next_action,next_attempt_at)
  values(target_org,channel_name,channel_name,event_name,'integration_event',idem_key,coalesce(event_payload,'{}'::jsonb),'pending'::public.sync_status,'pending',coalesce(event_risk,'low'),rule,action,now())
  on conflict (organization_id,channel,event_type,idempotency_key) do update set payload=excluded.payload,risk=excluded.risk,business_rule=coalesce(excluded.business_rule,public.integration_outbox.business_rule),next_action=coalesce(excluded.next_action,public.integration_outbox.next_action),next_attempt_at=case when public.integration_outbox.status in ('done','manual_review') then public.integration_outbox.next_attempt_at else now() end
  returning id into result_id;
  return result_id;
end;
$$;

create or replace function public.claim_integration_outbox(worker_name text, batch_size integer default 20)
returns setof public.integration_outbox language plpgsql security definer set search_path=public as $$
begin
  return query with selected as (
    select id from public.integration_outbox
    where status in ('pending','queued','failed') and attempts<max_attempts and (next_attempt_at is null or next_attempt_at<=now()) and (locked_at is null or locked_at<now()-interval '15 minutes')
    order by created_at for update skip locked limit greatest(1,least(coalesce(batch_size,20),100))
  )
  update public.integration_outbox o set status='processing',sync_status='processing'::public.sync_status,attempts=o.attempts+1,last_attempt_at=now(),locked_at=now(),locked_by=coalesce(worker_name,'worker')
  from selected s where o.id=s.id returning o.*;
end;
$$;

create or replace function public.confirm_external_payment(target_org uuid,target_case uuid,transaction_value text,payment_reference_value text,amount_value numeric,currency_value text,provider_value text,confirmed_timestamp timestamptz,payment_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_case public.cases%rowtype; v_payment public.payments%rowtype; v_contract_signed boolean; v_outbox uuid;
begin
  if amount_value is null or amount_value<=0 then raise exception 'payment_amount_required'; end if;
  if nullif(payment_reference_value,'') is null then raise exception 'payment_reference_required'; end if;
  select * into v_case from public.cases where id=target_case and organization_id=target_org for update;
  if not found then raise exception 'case_not_found'; end if;
  if coalesce(v_case.accepted_value,0)<=0 or not exists(select 1 from public.proposals p where p.case_id=target_case and p.organization_id=target_org and p.status='accepted' and p.current_version_id is not null) then raise exception 'proposal_not_accepted'; end if;
  select exists(select 1 from public.contracts where organization_id=target_org and case_id=target_case and status='signed') into v_contract_signed;
  if not v_contract_signed then raise exception 'contract_not_signed'; end if;
  insert into public.payments(organization_id,case_id,payment_reference,transaction_id,idempotency_key,reference,provider,method,amount,currency,status,confirmed_at,received_at,payload,updated_at)
  values(target_org,target_case,payment_reference_value,coalesce(nullif(transaction_value,''),payment_reference_value),coalesce(nullif(transaction_value,''),payment_reference_value),payment_reference_value,coalesce(nullif(provider_value,''),'manual'),coalesce(nullif(provider_value,''),'manual'),amount_value,coalesce(nullif(currency_value,''),v_case.currency,'EUR'),'confirmed',coalesce(confirmed_timestamp,now()),coalesce(confirmed_timestamp,now()),coalesce(payment_payload,'{}'::jsonb),now())
  on conflict (organization_id,payment_reference) do update set amount=excluded.amount,currency=excluded.currency,status='confirmed',confirmed_at=excluded.confirmed_at,received_at=excluded.received_at,payload=excluded.payload,updated_at=now() returning * into v_payment;
  update public.cases set status='payment_confirmed',next_action='Revisión fiscal manual y coordinación de proveedores',blocker=null,updated_at=now(),last_event_at=now() where id=target_case and organization_id=target_org;
  insert into public.timeline_events(organization_id,case_id,event_type,title,payload) values(target_org,target_case,'payment.confirmed','Pago confirmado',jsonb_build_object('payment_id',v_payment.id,'amount',amount_value,'currency',v_payment.currency,'reference',payment_reference_value));
  v_outbox:=public.enqueue_integration_event(target_org,'payment','payment.confirmed','payment:'||coalesce(nullif(transaction_value,''),payment_reference_value),jsonb_build_object('payment_id',v_payment.id,'case_id',target_case,'amount',amount_value,'currency',v_payment.currency),'high','La fiscalidad permanece en manual_review.','Revisar emisión fiscal y sincronización con Holded.');
  return jsonb_build_object('payment_id',v_payment.id,'case_id',target_case,'outbox_id',v_outbox,'status','confirmed');
end;
$$;

create or replace function public.confirm_supplier_invoice_upload(target_org uuid,target_purchase uuid,target_case uuid,document_title text,storage_bucket text,object_path text,original_file_name text,object_mime_type text,object_size_bytes bigint,object_checksum text,invoice_number_value text,invoice_date_value date,invoice_base_value numeric,invoice_tax_value numeric,invoice_total_value numeric,invoice_currency_value text,retention_days integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_purchase public.expected_purchases%rowtype; v_document public.documents%rowtype; v_invoice public.supplier_invoices%rowtype; v_retention date;
begin
  select * into v_purchase from public.expected_purchases where id=target_purchase and organization_id=target_org and case_id=target_case for update;
  if not found then raise exception 'expected_purchase_not_found'; end if;
  if nullif(object_path,'') is null then raise exception 'storage_path_required'; end if;
  if object_path not like target_org::text||'/%' then raise exception 'storage_path_scope_mismatch'; end if;
  v_retention:=current_date+greatest(1,least(coalesce(retention_days,365),3650));
  insert into public.documents(organization_id,case_id,owner_type,owner_id,document_type,title,type,status,storage_bucket,bucket,storage_path,file_name,mime_type,size_bytes,checksum,sensitivity,retention_until,access_purpose,required,uploaded_at,updated_at)
  values(target_org,target_case,'supplier_invoice',target_purchase,'supplier_invoice',coalesce(nullif(document_title,''),'Factura de proveedor'),'supplier_invoice','reviewing',coalesce(nullif(storage_bucket,''),'invoices'),coalesce(nullif(storage_bucket,''),'invoices'),object_path,original_file_name,object_mime_type,object_size_bytes,object_checksum,'private',v_retention,'supplier_invoice_upload',true,now(),now())
  on conflict (organization_id,storage_path) do update set file_name=excluded.file_name,mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,checksum=excluded.checksum,updated_at=now() returning * into v_document;
  insert into public.supplier_invoices(organization_id,expected_purchase_id,supplier_id,invoice_number,invoice_date,base_amount,tax_amount,total_amount,currency,storage_path,status,file_name,mime_type,size_bytes,checksum,uploaded_at,updated_at)
  values(target_org,target_purchase,v_purchase.supplier_id,invoice_number_value,invoice_date_value,invoice_base_value,invoice_tax_value,invoice_total_value,coalesce(nullif(invoice_currency_value,''),v_purchase.currency,'EUR'),object_path,'reviewing',original_file_name,object_mime_type,object_size_bytes,object_checksum,now(),now())
  on conflict (organization_id,storage_path) do update set invoice_number=excluded.invoice_number,invoice_date=excluded.invoice_date,base_amount=excluded.base_amount,tax_amount=excluded.tax_amount,total_amount=excluded.total_amount,currency=excluded.currency,file_name=excluded.file_name,mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,checksum=excluded.checksum,updated_at=now() returning * into v_invoice;
  update public.expected_purchases set status='uploaded'::public.expected_purchase_status,uploaded_at=now(),invoice_number=invoice_number_value,invoice_date=invoice_date_value,invoice_base=invoice_base_value,invoice_tax=invoice_tax_value,invoice_total=invoice_total_value,updated_at=now() where id=target_purchase;
  insert into public.timeline_events(organization_id,case_id,event_type,title,payload) values(target_org,target_case,'supplier_invoice.uploaded','Factura de proveedor recibida',jsonb_build_object('expected_purchase_id',target_purchase,'supplier_invoice_id',v_invoice.id,'document_id',v_document.id));
  return jsonb_build_object('document',to_jsonb(v_document),'supplier_invoice',to_jsonb(v_invoice),'expected_purchase_id',target_purchase);
end;
$$;

create or replace function public.operational_close_preflight(target_case uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_case public.cases%rowtype; blockers jsonb:='[]'::jsonb; pending_purchases integer:=0; integration_errors integer:=0; payment_total numeric:=0; ready boolean:=false;
begin
  select * into v_case from public.cases where id=target_case for update;
  if not found then raise exception 'case_not_found'; end if;
  if v_case.trip_end is null or v_case.trip_end>current_date then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','trip_not_finished','message','El viaje todavía no ha finalizado.')); end if;
  if not exists(select 1 from public.proposals p join public.proposal_versions pv on pv.id=p.current_version_id where p.case_id=target_case and p.organization_id=v_case.organization_id and p.status='accepted' and pv.locked=true) then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','accepted_budget_missing','message','No existe una versión aceptada y bloqueada.')); end if;
  if not exists(select 1 from public.contracts where organization_id=v_case.organization_id and case_id=target_case and status='signed') then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','contract_not_signed','message','El contrato no está firmado.')); end if;
  select coalesce(sum(amount),0) into payment_total from public.payments where organization_id=v_case.organization_id and case_id=target_case and status='confirmed';
  if payment_total<coalesce(v_case.accepted_value,0) then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','payment_incomplete','message','El pago confirmado no cubre la venta aceptada.','confirmed',payment_total,'required',coalesce(v_case.accepted_value,0))); end if;
  select count(*) into pending_purchases from public.expected_purchases where case_id=target_case and organization_id=v_case.organization_id and status not in ('approved','not_required','cancelled');
  if pending_purchases>0 then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','supplier_purchases_pending','message','Hay compras o facturas de proveedor pendientes.','count',pending_purchases)); end if;
  select count(*) into integration_errors from public.integration_outbox where related_case_id=target_case and organization_id=v_case.organization_id and status in ('failed','manual_review');
  if integration_errors>0 then blockers:=blockers||jsonb_build_array(jsonb_build_object('code','integration_errors','message','Hay errores o revisiones de integración pendientes.','count',integration_errors)); end if;
  ready:=jsonb_array_length(blockers)=0;
  update public.cases set closure_check_at=now(),close_blockers=blockers,status=case when ready and status<>'closed' then 'ready_to_close'::public.case_status else status end,next_action=case when ready then 'Revisar y cerrar expediente' else next_action end,blocker=case when ready then null else 'Preflight de cierre con bloqueos pendientes' end,updated_at=now() where id=target_case;
  return jsonb_build_object('ready',ready,'case_id',target_case,'blockers',blockers,'pending_purchases',pending_purchases,'integration_errors',integration_errors,'confirmed_payments',payment_total);
end;
$$;

revoke all on function public.enqueue_integration_event(uuid,text,text,text,jsonb,text,text,text) from public,anon,authenticated;
revoke all on function public.claim_integration_outbox(text,integer) from public,anon,authenticated;
revoke all on function public.confirm_external_payment(uuid,uuid,text,text,numeric,text,text,timestamptz,jsonb) from public,anon,authenticated;
revoke all on function public.confirm_supplier_invoice_upload(uuid,uuid,uuid,text,text,text,text,text,bigint,text,text,date,numeric,numeric,numeric,text,integer) from public,anon,authenticated;
revoke all on function public.operational_close_preflight(uuid) from public,anon,authenticated;
grant execute on function public.enqueue_integration_event(uuid,text,text,text,jsonb,text,text,text) to service_role;
grant execute on function public.claim_integration_outbox(text,integer) to service_role;
grant execute on function public.confirm_external_payment(uuid,uuid,text,text,numeric,text,text,timestamptz,jsonb) to service_role;
grant execute on function public.confirm_supplier_invoice_upload(uuid,uuid,uuid,text,text,text,text,text,bigint,text,text,date,numeric,numeric,numeric,text,integer) to service_role;
grant execute on function public.operational_close_preflight(uuid) to service_role;
