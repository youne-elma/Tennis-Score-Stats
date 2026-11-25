-- Apply after coach-applications.sql, the Edge Function, and the Vault settings.
begin;

create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function private.wake_coach_application_email_worker()
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
    select 1 from private.coach_application_emails where state = 'pending' and available_at <= now()
  ) then
    return;
  end if;

  select decrypted_secret into project_url
  from vault.decrypted_secrets where name = 'coach_application_project_url';
  select decrypted_secret into worker_secret
  from vault.decrypted_secrets where name = 'coach_application_worker_secret';

  if project_url is not null and worker_secret is not null then
    perform net.http_post(
      url := rtrim(project_url, '/') || '/functions/v1/coach-application-email',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-coach-application-secret', worker_secret),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  end if;
end;
$$;

create or replace function private.wake_coach_application_email_on_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.wake_coach_application_email_worker();
  return null;
exception when others then
  raise warning 'Unable to wake coach application email worker (%)', SQLSTATE;
  return null;
end;
$$;

revoke all on function private.wake_coach_application_email_worker() from public, anon, authenticated;
revoke all on function private.wake_coach_application_email_on_insert() from public, anon, authenticated;

drop trigger if exists wake_coach_application_email_on_insert on private.coach_application_emails;
create trigger wake_coach_application_email_on_insert
after insert on private.coach_application_emails
for each statement execute function private.wake_coach_application_email_on_insert();

select cron.schedule(
  'coach-application-emails',
  '* * * * *',
  'select private.wake_coach_application_email_worker();'
);

commit;
