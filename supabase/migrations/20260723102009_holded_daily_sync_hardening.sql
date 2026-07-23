-- Stabilize daily Holded supplier invoice sync after moving from 15-minute Vercel cron to Hobby-compatible daily cron.
-- The runtime now uses the last successful integration run as cursor; this setting only controls the first backfill window.

delete from public.routsify_settings
where key = 'purchases.holded.sync_interval_minutes';

insert into public.routsify_settings(
  organization_id,
  module,
  key,
  value,
  default_value,
  value_type,
  scope,
  editable,
  requires_recalculation,
  affected_modules,
  updated_at
)
select
  o.id,
  v.module,
  v.key,
  v.value,
  v.value,
  v.value_type,
  'global',
  true,
  false,
  v.affected_modules,
  now()
from public.organizations o
cross join (values
  ('purchases', 'purchases.holded.initial_backfill_days', '30'::jsonb, 'number', array['purchases','integrations']),
  ('integrations', 'alerts.operations_email', '""'::jsonb, 'string', array['integrations','purchases'])
) as v(module, key, value, value_type, affected_modules)
on conflict (organization_id, key) do update
set module = excluded.module,
    default_value = excluded.default_value,
    value_type = excluded.value_type,
    scope = excluded.scope,
    editable = excluded.editable,
    affected_modules = excluded.affected_modules,
    updated_at = now();
