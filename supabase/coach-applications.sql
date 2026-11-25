-- Apply after user-roles.sql and chat-rls.sql.
begin;

create table if not exists public.coach_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 100),
  club text check (char_length(club) <= 100),
  experience text not null check (char_length(btrim(experience)) between 1 and 1500),
  motivation text not null check (char_length(btrim(motivation)) between 1 and 1500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  check ((status = 'pending') = (reviewed_at is null))
);

create unique index if not exists coach_applications_one_pending_idx
  on public.coach_applications (user_id) where status = 'pending';
create index if not exists coach_applications_user_created_idx on public.coach_applications (user_id, created_at desc);
create index if not exists coach_applications_pending_idx
  on public.coach_applications (created_at, id) where status = 'pending';

alter table public.coach_applications enable row level security;
revoke all on public.coach_applications from public, anon, authenticated;
grant select on public.coach_applications to authenticated;

drop policy if exists "coach_applications_read" on public.coach_applications;
create policy "coach_applications_read" on public.coach_applications
for select to authenticated
using (user_id = (select auth.uid()) or (select private.current_user_role()) = 'admin');

create or replace function public.submit_coach_application(
  p_full_name text,
  p_club text,
  p_experience text,
  p_motivation text
)
returns public.coach_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  application public.coach_applications;
begin
  -- Synchronize submissions with changes to this account's role.
  perform 1 from public.user_roles where user_id = actor_id and role = 'user' for share;
  if not found then
    raise exception using errcode = '42501', message = 'A player account is required.';
  end if;

  insert into public.coach_applications (user_id, full_name, club, experience, motivation)
  values (actor_id, btrim(p_full_name), nullif(btrim(p_club), ''), btrim(p_experience), btrim(p_motivation))
  on conflict (user_id) where status = 'pending' do nothing
  returning * into application;

  if not found then
    select * into application from public.coach_applications where user_id = actor_id
    order by created_at desc, id desc limit 1;
  end if;
  return application;
end;
$$;

create or replace function public.review_coach_application(p_application_id uuid, p_decision text)
returns public.coach_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  application public.coach_applications;
  applicant_role text;
begin
  perform 1 from public.user_roles where user_id = actor_id and role = 'admin' for share;
  if not found then
    raise exception using errcode = '42501', message = 'An administrator is required.';
  end if;
  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception using errcode = '22023', message = 'Choose an approval or a rejection.';
  end if;

  -- Use the same lock order as submission when approval also changes the account's role.
  if p_decision = 'approved' then
    select role into applicant_role from public.user_roles
    where user_id = (select user_id from public.coach_applications where id = p_application_id)
    for update;
  end if;

  select * into application from public.coach_applications where id = p_application_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Application unavailable.';
  end if;
  if application.status = p_decision then
    return application;
  end if;
  if application.status <> 'pending' then
    raise exception using errcode = '22023', message = 'This application has already been reviewed.';
  end if;

  if p_decision = 'approved' then
    if applicant_role = 'user' then
      update public.user_roles set role = 'coach' where user_id = application.user_id;
    elsif applicant_role is distinct from 'coach' then
      raise exception using errcode = '22023', message = 'The applicant already has a different role.';
    end if;
  end if;

  update public.coach_applications
  set status = p_decision, reviewed_by = actor_id, reviewed_at = now()
  where id = p_application_id returning * into application;
  return application;
end;
$$;

revoke all on function public.submit_coach_application(text, text, text, text) from public, anon, authenticated;
revoke all on function public.review_coach_application(uuid, text) from public, anon, authenticated;
grant execute on function public.submit_coach_application(text, text, text, text) to authenticated;
grant execute on function public.review_coach_application(uuid, text) to authenticated;

create table if not exists private.coach_application_emails (
  application_id uuid primary key references public.coach_applications (id) on delete cascade,
  state text not null default 'pending' check (state in ('pending', 'sent', 'failed')),
  available_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_error text
);

create index if not exists coach_application_emails_due_idx
  on private.coach_application_emails (available_at) where state = 'pending';

revoke all on private.coach_application_emails from public, anon, authenticated;

create or replace function private.enqueue_coach_application_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.coach_application_emails (application_id) values (new.id);
  return new;
end;
$$;

revoke all on function private.enqueue_coach_application_email() from public, anon, authenticated;
drop trigger if exists enqueue_coach_application_email on public.coach_applications;
create trigger enqueue_coach_application_email after insert on public.coach_applications
for each row execute function private.enqueue_coach_application_email();

create or replace function public.claim_coach_application_emails()
returns table (
  application_id uuid,
  attempts integer,
  full_name text,
  club text,
  experience text,
  motivation text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.coach_application_emails job
  set state = 'failed', last_error = coalesce(job.last_error, 'RetryLimit')
  where job.state = 'pending' and job.available_at <= now() and job.attempts >= 6;

  return query
  with due as (
    select job.application_id
    from private.coach_application_emails job
    where job.state = 'pending' and job.available_at <= now()
    order by job.available_at, job.application_id
    limit 5
    for update skip locked
  )
  update private.coach_application_emails job
  set attempts = job.attempts + 1, available_at = now() + interval '2 minutes'
  from due join public.coach_applications application on application.id = due.application_id
  where job.application_id = due.application_id
  returning job.application_id, job.attempts, application.full_name,
    application.club, application.experience, application.motivation;
end;
$$;

create or replace function public.finish_coach_application_emails(p_results jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  update private.coach_application_emails job
  set state = case
      when result.error_code is null then 'sent'
      when result.retry and job.attempts < 6 then 'pending'
      else 'failed'
    end,
    last_error = left(result.error_code, 80),
    available_at = now() + interval '1 minute' * power(2, job.attempts - 1)
  from jsonb_to_recordset(p_results) as result(application_id uuid, attempts integer, retry boolean, error_code text)
  where job.application_id = result.application_id and job.attempts = result.attempts and job.state = 'pending';
$$;

revoke all on function public.claim_coach_application_emails() from public, anon, authenticated;
revoke all on function public.finish_coach_application_emails(jsonb) from public, anon, authenticated;
grant execute on function public.claim_coach_application_emails() to service_role;
grant execute on function public.finish_coach_application_emails(jsonb) to service_role;

commit;
