-- Provider delivery metadata for SMTP and WhatsApp Cloud API.
-- Existing communications remain unchanged.

alter table public.communication_followups
  add column if not exists provider text,
  add column if not exists provider_message_id text,
  add column if not exists provider_status text,
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists provider_error text;

create index if not exists communication_followups_provider_message_idx
  on public.communication_followups(provider, provider_message_id)
  where provider_message_id is not null;
