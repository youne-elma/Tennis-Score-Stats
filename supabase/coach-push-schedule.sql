-- Apply on hosted Supabase after coach-push.sql and storing the worker settings in Vault.
begin;

create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function private.wake_coach_push_worker()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  worker_secret text;
begin
  if not exists (
    select 1 from public.coach_push_deliveries
    where state in ('pending', 'submitted') and available_at <= now()
  ) then
    return;
  end if;

  select decrypted_secret into project_url
  from vault.decrypted_secrets where name = 'coach_push_project_url';
  select decrypted_secret into worker_secret
  from vault.decrypted_secrets where name = 'coach_push_worker_secret';

  if project_url is not null and worker_secret is not null then
    perform net.http_post(
      url := rtrim(project_url, '/') || '/functions/v1/coach-push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-coach-push-secret', worker_secret),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  end if;
end;
$$;

create or replace function private.wake_coach_push_worker_on_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from enqueued_deliveries) then
    perform private.wake_coach_push_worker();
  end if;
  return null;
exception when others then
  -- Cron can pick up the queued deliveries after a temporary failure to wake the worker.
  raise warning 'Unable to wake coach push worker (%)', SQLSTATE;
  return null;
end;
$$;

revoke all on function private.wake_coach_push_worker() from public, anon, authenticated;
revoke all on function private.wake_coach_push_worker_on_insert() from public, anon, authenticated;

drop trigger if exists wake_coach_push_worker_on_insert on public.coach_push_deliveries;
create trigger wake_coach_push_worker_on_insert
after insert on public.coach_push_deliveries
referencing new table as enqueued_deliveries
for each statement execute function private.wake_coach_push_worker_on_insert();

select cron.schedule(
  'coach-reply-push-deliveries',
  '* * * * *',
  'select private.wake_coach_push_worker();'
);

commit;
