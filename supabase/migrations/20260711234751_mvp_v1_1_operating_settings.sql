insert into public.routsify_settings(organization_id,module,key,value,default_value,value_type,scope,editable,requires_recalculation,affected_modules,updated_at)
select o.id,v.module,v.key,v.value,v.value,v.value_type,'global',v.editable,false,v.modules,now()
from public.organizations o cross join (values
 ('integrations','integrations.holded.mode','"full_sync"'::jsonb,'select',true,array['holded','outbox']::text[]),
 ('integrations','integrations.holded.sync.contacts','true'::jsonb,'boolean',true,array['holded']::text[]),
 ('integrations','integrations.holded.sync.estimates','true'::jsonb,'boolean',true,array['holded']::text[]),
 ('integrations','integrations.holded.sync.proformas','true'::jsonb,'boolean',true,array['holded']::text[]),
 ('integrations','integrations.holded.sync.invoices','true'::jsonb,'boolean',true,array['holded']::text[]),
 ('integrations','integrations.holded.sync.purchases','true'::jsonb,'boolean',true,array['holded']::text[]),
 ('integrations','integrations.holded.sync.payments','true'::jsonb,'boolean',true,array['holded']::text[]),
 ('integrations','integrations.ocr.provider','"openai"'::jsonb,'select',true,array['ocr','documents']::text[]),
 ('integrations','integrations.ocr.model','"gpt-5-mini"'::jsonb,'string',true,array['ocr']::text[]),
 ('contracts','payments.provider','"manual_link"'::jsonb,'select',true,array['contracts','payments']::text[]),
 ('documents','documents.retention_days','1825'::jsonb,'number',true,array['documents','security','ocr']::text[]),
 ('documents','documents.sensitive_roles','["admin","sales"]'::jsonb,'multi_select',false,array['documents','travelers','ocr']::text[]),
 ('fiscal','fiscal.mode','"proforma_on_payment_final_after_trip"'::jsonb,'select',true,array['fiscal','holded','cases']::text[]),
 ('fiscal','fiscal.final_invoice_delay_days','5'::jsonb,'number',true,array['fiscal','jobs','cases']::text[])
) as v(module,key,value,value_type,editable,modules)
on conflict(organization_id,key) do update set value=excluded.value,default_value=excluded.default_value,value_type=excluded.value_type,editable=excluded.editable,affected_modules=excluded.affected_modules,updated_at=now();

