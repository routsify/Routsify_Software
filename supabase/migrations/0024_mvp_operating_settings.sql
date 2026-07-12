-- Fixed operating policy approved for MVP v1.1.
insert into public.routsify_settings(organization_id,module,key,value,label,description,updated_at)
select o.id,v.module,v.key,v.value,v.label,v.description,now()
from public.organizations o cross join (values
 ('integrations','integrations.holded.mode','"outbox_idempotent"'::jsonb,'Modo Holded','Sincronización idempotente con reintentos.'),
 ('integrations','integrations.holded.modules','["contacts","estimates","proformas","invoices","purchases","payments"]'::jsonb,'Módulos Holded','Contactos, presupuestos, proformas, facturas, compras y pagos.'),
 ('integrations','integrations.holded.base_url','"https://api.holded.com/api"'::jsonb,'Base API Holded','URL base de Holded.'),
 ('integrations','integrations.holded.endpoint.contacts','"/invoicing/v1/contacts"'::jsonb,'Endpoint contactos','Contactos Holded.'),
 ('integrations','integrations.holded.endpoint.estimates','"/invoicing/v1/documents/estimate"'::jsonb,'Endpoint presupuestos','Presupuestos Holded.'),
 ('integrations','integrations.holded.endpoint.proformas','"/invoicing/v1/documents/proform"'::jsonb,'Endpoint proformas','Proformas Holded.'),
 ('integrations','integrations.holded.endpoint.invoices','"/invoicing/v1/documents/invoice"'::jsonb,'Endpoint facturas','Facturas Holded.'),
 ('integrations','integrations.holded.endpoint.purchases','"/invoicing/v1/documents/purchase"'::jsonb,'Endpoint compras','Compras Holded.'),
 ('integrations','integrations.holded.endpoint.payments','"/invoicing/v1/payments"'::jsonb,'Endpoint pagos','Pagos Holded.'),
 ('integrations','integrations.ocr.provider','"openai"'::jsonb,'Proveedor OCR','OpenAI Responses API con revisión humana.'),
 ('integrations','integrations.ocr.model','"gpt-4.1-mini"'::jsonb,'Modelo OCR','Modelo configurable para extracción documental.'),
 ('payments','payments.provider','"teya_manual"'::jsonb,'Proveedor de pago','Enlace Teya y confirmación manual.'),
 ('fiscal','fiscal.mode','"proforma_on_payment_final_after_trip"'::jsonb,'Modo fiscal','Proforma al pago y factura final viaje + 5 días.'),
 ('fiscal','fiscal.final_invoice_delay_days','5'::jsonb,'Espera factura final','Cinco días tras finalizar el viaje.'),
 ('documents','documents.retention_days','1825'::jsonb,'Retención documentos','Cinco años.'),
 ('security','security.sensitive_document_roles','["admin","sales"]'::jsonb,'Roles documentos sensibles','Administración y ventas.')
) as v(module,key,value,label,description)
on conflict(organization_id,key) do update set value=excluded.value,label=excluded.label,description=excluded.description,updated_at=now();
