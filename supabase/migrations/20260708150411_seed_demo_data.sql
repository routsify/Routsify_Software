with org as (
  insert into public.organizations (name, slug, fiscal_mode, brand_primary_color, brand_background_color)
  values ('Routsify Demo Agency', 'routsify-demo', 'manual_review', '#379237', '#ffffff')
  on conflict (slug) do update set name = excluded.name
  returning id
), service_seed as (
  insert into public.service_types (organization_id, code, name, sort_order)
  select id, code, name, sort_order from org cross join (values
    ('hotel','Hotel',10),
    ('flight','Vuelo',20),
    ('transfer','Traslado',30),
    ('activity','Actividad',40),
    ('insurance','Seguro',50),
    ('guide','Guía',60),
    ('fee','Fee de agencia',70)
  ) as v(code,name,sort_order)
  on conflict (organization_id, code) do update set name = excluded.name, sort_order = excluded.sort_order
  returning id, organization_id, code
), suppliers_seed as (
  insert into public.suppliers (organization_id, name, email, country, notes)
  select id, name, email, country, notes from org cross join (values
    ('Hotel Aurora Kyoto','reservas@aurora-kyoto.example','JP','Proveedor ficticio para demo'),
    ('Japan Private Transfers','ops@japan-transfers.example','JP','Proveedor ficticio para demo'),
    ('Global Travel Insurance','claims@global-insurance.example','ES','Proveedor ficticio para demo')
  ) as v(name,email,country,notes)
  returning id, organization_id, name
), client_seed as (
  insert into public.clients (organization_id, client_type, display_name, first_name, last_name, email, email_normalized, phone, phone_normalized, country, source, notes)
  select id, 'person', 'Laura Martín', 'Laura', 'Martín', 'laura.martin@example.com', 'laura.martin@example.com', '+34 600 111 222', '34600111222', 'ES', 'fillout', 'Cliente demo: viaje a Japón a medida' from org
  on conflict (organization_id, email_normalized) do update set display_name = excluded.display_name
  returning id, organization_id
), lead_seed as (
  insert into public.leads (organization_id, client_id, source, source_submission_id, payload_hash, payload_redacted, status, campaign, destination, travel_start, travel_end, budget_hint)
  select organization_id, id, 'fillout', 'demo-fillout-001', encode(digest('demo-fillout-001', 'sha256'), 'hex'), '{"viajeros":2,"intereses":["cultura","gastronomía","ryokan"]}', 'qualified', 'demo-web', 'Japón', '2026-10-05', '2026-10-18', 8500 from client_seed
  on conflict (organization_id, source, source_submission_id) do update set status = excluded.status
  returning id, organization_id, client_id
), case_seed as (
  insert into public.cases (organization_id, client_id, lead_id, case_code, title, status, destination, trip_start, trip_end, next_action, next_action_at, blocker, currency, accepted_value)
  select organization_id, client_id, id, 'EXP-2026-0001', 'Japón a medida - Octubre 2026', 'budget_draft', 'Japón', '2026-10-05', '2026-10-18', 'Completar presupuesto y revisar margen', now() + interval '1 day', 'Faltan costes finales de proveedores', 'EUR', 0 from lead_seed
  on conflict (organization_id, case_code) do update set title = excluded.title
  returning id, organization_id, trip_end
), proposal_seed as (
  insert into public.proposals (organization_id, case_id, title, public_token_hash, public_token_expires_at)
  select organization_id, id, 'Propuesta Japón esencial y ryokan', encode(digest('demo-public-token', 'sha256'), 'hex'), now() + interval '30 days' from case_seed
  returning id, organization_id, case_id
), version_seed as (
  insert into public.proposal_versions (organization_id, proposal_id, version_number, status, title, narrative, terms_snapshot, margin_snapshot, total_sale, total_cost_budget, budgeted_profit)
  select organization_id, id, 1, 'draft', 'Japón esencial y ryokan', '{"headline":"Un Japón diseñado a medida, combinando Tokio, Kioto y experiencia ryokan.","highlights":["Hoteles boutique","Traslados privados clave","Experiencias gastronómicas"]}', 'Condiciones demo sujetas a disponibilidad.', '{"mode":"per_budget","default_margin":0.25}', 7200, 5400, 1800 from proposal_seed
  returning id, organization_id, proposal_id
), set_current as (
  update public.proposals p set current_version_id = v.id from version_seed v where p.id = v.proposal_id returning p.id
), hotel_line as (
  insert into public.budget_lines (organization_id, proposal_version_id, stable_line_id, service_type_id, service_type_code, description_internal, description_public, supplier_id, destination_segment, start_date, end_date, cost_budget, margin_applied, sale_price, creates_expected_purchase, sort_order)
  select v.organization_id, v.id, 'LINE-HOTEL-KYOTO-001', st.id, 'hotel', 'Hotel boutique Kioto 5 noches', '5 noches en hotel boutique seleccionado en Kioto con desayuno incluido.', s.id, 'Kioto', '2026-10-10', '2026-10-15', 2600, 0.25, 3466.67, true, 10
  from version_seed v join service_seed st on st.organization_id=v.organization_id and st.code='hotel' join suppliers_seed s on s.organization_id=v.organization_id and s.name='Hotel Aurora Kyoto'
  returning id, organization_id, proposal_version_id, supplier_id, cost_budget
), transfer_line as (
  insert into public.budget_lines (organization_id, proposal_version_id, stable_line_id, service_type_id, service_type_code, description_internal, description_public, supplier_id, destination_segment, start_date, end_date, cost_budget, margin_applied, sale_price, creates_expected_purchase, sort_order)
  select v.organization_id, v.id, 'LINE-TRANSFER-001', st.id, 'transfer', 'Traslados privados aeropuertos y estaciones', 'Traslados privados en los puntos clave del itinerario para viajar sin fricción.', s.id, 'Tokio/Kioto', '2026-10-05', '2026-10-18', 900, 0.25, 1200, true, 20
  from version_seed v join service_seed st on st.organization_id=v.organization_id and st.code='transfer' join suppliers_seed s on s.organization_id=v.organization_id and s.name='Japan Private Transfers'
  returning id, organization_id, proposal_version_id, supplier_id, cost_budget
), fee_line as (
  insert into public.budget_lines (organization_id, proposal_version_id, stable_line_id, service_type_id, service_type_code, description_internal, description_public, supplier_id, destination_segment, cost_budget, margin_applied, sale_price, creates_expected_purchase, sort_order)
  select v.organization_id, v.id, 'LINE-FEE-001', st.id, 'fee', 'Fee diseño y soporte', 'Diseño del viaje, coordinación operativa y soporte antes y durante el viaje.', null, 'General', 0, 1, 950, false, 30
  from version_seed v join service_seed st on st.organization_id=v.organization_id and st.code='fee'
  returning id
)
insert into public.expected_purchases (organization_id, case_id, proposal_version_id, budget_line_id, supplier_id, status, expected_amount, due_date)
select l.organization_id, c.id, l.proposal_version_id, l.id, l.supplier_id, 'expected'::public.expected_purchase_status, l.cost_budget, c.trip_end + 5
from hotel_line l cross join case_seed c
union all
select l.organization_id, c.id, l.proposal_version_id, l.id, l.supplier_id, 'expected'::public.expected_purchase_status, l.cost_budget, c.trip_end + 5
from transfer_line l cross join case_seed c;

