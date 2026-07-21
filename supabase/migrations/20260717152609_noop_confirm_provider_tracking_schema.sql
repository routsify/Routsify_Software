do $$ begin if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='communication_followups' and column_name='provider_message_id') then raise exception 'provider tracking migration missing'; end if; end $$;

