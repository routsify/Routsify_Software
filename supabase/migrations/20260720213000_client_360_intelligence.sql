-- Internal CRM intelligence for Cliente 360. Holded remains the external client/provider portal.

alter table public.clients add column if not exists segment text not null default 'standard';
alter table public.clients add column if not exists relationship_status text not null default 'active';
alter table public.clients add column if not exists preferred_contact_channel text not null default 'whatsapp';
alter table public.clients add column if not exists risk_level text not null default 'low';
alter table public.clients add column if not exists tags text[] not null default '{}'::text[];
alter table public.clients add column if not exists travel_preferences jsonb not null default '{}'::jsonb;
alter table public.clients add column if not exists next_opportunity_at date;
alter table public.clients add column if not exists last_contact_at timestamptz;
alter table public.clients add column if not exists profile_updated_at timestamptz;

alter table public.clients drop constraint if exists clients_segment_check;
alter table public.clients add constraint clients_segment_check check (segment = any (array['standard','priority','vip','corporate','dormant']::text[]));
alter table public.clients drop constraint if exists clients_relationship_status_check;
alter table public.clients add constraint clients_relationship_status_check check (relationship_status = any (array['active','nurture','dormant','do_not_contact']::text[]));
alter table public.clients drop constraint if exists clients_preferred_contact_channel_check;
alter table public.clients add constraint clients_preferred_contact_channel_check check (preferred_contact_channel = any (array['whatsapp','email','phone']::text[]));
alter table public.clients drop constraint if exists clients_risk_level_check;
alter table public.clients add constraint clients_risk_level_check check (risk_level = any (array['low','medium','high']::text[]));
alter table public.clients drop constraint if exists clients_travel_preferences_object_check;
alter table public.clients add constraint clients_travel_preferences_object_check check (jsonb_typeof(travel_preferences) = 'object');

create index if not exists clients_org_segment_idx on public.clients(organization_id, segment, relationship_status);
create index if not exists clients_org_next_opportunity_idx on public.clients(organization_id, next_opportunity_at) where next_opportunity_at is not null;
create index if not exists clients_tags_gin_idx on public.clients using gin(tags);

comment on column public.clients.segment is 'Internal commercial segment. Not an external portal field.';
comment on column public.clients.travel_preferences is 'Internal travel preferences used by Routsify operations and proposals.';
comment on column public.clients.next_opportunity_at is 'Next suggested commercial contact or travel opportunity date.';
