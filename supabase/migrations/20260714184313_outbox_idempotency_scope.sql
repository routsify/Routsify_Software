alter table public.integration_outbox drop constraint if exists integration_outbox_provider_idempotency_key_key; create unique index if not exists integration_outbox_routsify_idempotency_idx on public.integration_outbox (organization_id, channel, event_type, idempotency_key);

