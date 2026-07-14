-- Duplicate webhook/job delivery must not reopen completed or cancelled tasks.

create or replace function public.preserve_terminal_task_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status in ('done', 'cancelled') and new.status is distinct from old.status then
    new.status := old.status;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_preserve_terminal_status on public.tasks;
create trigger tasks_preserve_terminal_status
before update on public.tasks
for each row execute function public.preserve_terminal_task_status();

revoke all on function public.preserve_terminal_task_status() from public, anon, authenticated;
