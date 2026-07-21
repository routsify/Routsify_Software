create table if not exists public.release_payload_chunks (
  release_token text not null,
  sequence_no integer not null,
  payload_chunk text not null,
  expires_at timestamptz not null default (now() + interval '6 hours'),
  consumed_at timestamptz,
  primary key (release_token, sequence_no)
);
alter table public.release_payload_chunks enable row level security;
revoke all on public.release_payload_chunks from public, anon, authenticated;
grant all on public.release_payload_chunks to service_role;

