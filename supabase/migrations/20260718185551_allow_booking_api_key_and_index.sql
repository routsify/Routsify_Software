alter table public.organization_secrets drop constraint if exists organization_secrets_secret_key_check;
alter table public.organization_secrets add constraint organization_secrets_secret_key_check check (secret_key = any (array['holded_api_key'::text,'openai_api_key'::text,'fillout_webhook_secret'::text,'booking_webhook_secret'::text,'booking_api_key'::text,'smtp_username'::text,'smtp_password'::text,'whatsapp_access_token'::text,'whatsapp_verify_token'::text,'whatsapp_app_secret'::text]));
create index if not exists bookings_org_external_latest_idx on public.bookings (organization_id, external_booking_id, updated_at desc);

