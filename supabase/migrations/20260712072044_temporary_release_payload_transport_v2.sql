create table if not exists public.release_payload_chunks (
  release_token text not null,
  sequence_no integer not null,
  payload_chunk text not null,
  expires_at timestamptz not null default (now() + interval '2 hours'),
  consumed_at timestamptz,
  primary key (release_token, sequence_no)
);
alter table public.release_payload_chunks enable row level security;
revoke all on public.release_payload_chunks from public, anon, authenticated;

create or replace function public.fetch_release_payload(token_value text)
returns table(sequence_no integer, payload_chunk text)
language sql
security definer
set search_path = public
stable
as $$
  select r.sequence_no, r.payload_chunk
  from public.release_payload_chunks r
  where r.release_token = token_value
    and r.expires_at > now()
    and r.consumed_at is null
  order by r.sequence_no
$$;

create or replace function public.consume_release_payload(token_value text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare affected integer;
begin
  update public.release_payload_chunks
     set consumed_at = now(), payload_chunk = ''
   where release_token = token_value and consumed_at is null;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.fetch_release_payload(text) from public;
revoke all on function public.consume_release_payload(text) from public;
grant execute on function public.fetch_release_payload(text) to anon, authenticated, service_role;
grant execute on function public.consume_release_payload(text) to anon, authenticated, service_role;

