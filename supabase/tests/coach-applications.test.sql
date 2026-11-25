-- Run after coach-applications.sql in a test database. Fixtures are rolled back.
begin;

insert into auth.users (id, email) values
  ('83000000-0000-4000-8000-000000000001', 'coach-applicant@example.invalid'),
  ('83000000-0000-4000-8000-000000000002', 'coach-other-player@example.invalid'),
  ('83000000-0000-4000-8000-000000000003', 'coach-existing@example.invalid'),
  ('83000000-0000-4000-8000-000000000004', 'coach-reviewer@example.invalid');

update public.user_roles set role = 'coach' where user_id = '83000000-0000-4000-8000-000000000003';
update public.user_roles set role = 'admin' where user_id = '83000000-0000-4000-8000-000000000004';

set local role authenticated;
select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000001', true);

do $$
declare
  application public.coach_applications;
  duplicate public.coach_applications;
begin
  select * into application from public.submit_coach_application('  Léa Test  ', ' ', 'Club tennis', 'Help players');
  select * into duplicate from public.submit_coach_application('Other name', null, 'Other text', 'Other text');
  if application.full_name is distinct from 'Léa Test' or application.club is not null
    or application.status is distinct from 'pending' or duplicate.id is distinct from application.id
    or (select count(*) from public.coach_applications) <> 1 then
    raise exception 'The submission should be trimmed, visible to the owner and unique while pending';
  end if;
  perform set_config('test.coach_application_id', application.id::text, true);

  begin
    update public.coach_applications set status = 'approved';
    raise exception 'Players can write an application status directly';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.review_coach_application(application.id, 'approved');
    raise exception 'Players can approve applications';
  exception when insufficient_privilege then
    null;
  end;

  if has_function_privilege('authenticated', 'public.claim_coach_application_emails()', 'execute')
    or has_function_privilege('authenticated', 'public.finish_coach_application_emails(jsonb)', 'execute') then
    raise exception 'An app client can run the email worker';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000002', true);
do $$
declare
  application public.coach_applications;
begin
  if exists (select 1 from public.coach_applications) then
    raise exception 'An unrelated player can read another person''s application';
  end if;
  select * into application from public.submit_coach_application('Sami Test', 'Local club', 'Player', 'Teach tennis');
  perform set_config('test.other_coach_application_id', application.id::text, true);
end;
$$;

select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000003', true);
do $$
begin
  if exists (select 1 from public.coach_applications) then
    raise exception 'Coaches can read other people''s applications';
  end if;
  begin
    perform public.submit_coach_application('Coach', null, 'Player', 'Teach tennis');
    raise exception 'A coach can request their existing role';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000004', true);
do $$
declare
  application_id uuid := current_setting('test.coach_application_id')::uuid;
  other_id uuid := current_setting('test.other_coach_application_id')::uuid;
  first_review timestamptz;
  retried_review timestamptz;
begin
  if (select count(*) from public.coach_applications) <> 2 then
    raise exception 'The administrator cannot see both applications';
  end if;

  select reviewed_at into first_review from public.review_coach_application(application_id, 'approved');
  select reviewed_at into retried_review from public.review_coach_application(application_id, 'approved');
  perform public.review_coach_application(other_id, 'rejected');
  if first_review is null or first_review is distinct from retried_review
    or (select role from public.user_roles where user_id = '83000000-0000-4000-8000-000000000001') <> 'coach'
    or (select role from public.user_roles where user_id = '83000000-0000-4000-8000-000000000002') <> 'user'
    or (select count(*) from public.list_chat_coaches()) <> 2 then
    raise exception 'Approval should grant the role once and rejection should keep the player role';
  end if;

  begin
    perform public.review_coach_application(application_id, 'rejected');
    raise exception 'A completed decision could be overwritten';
  exception when invalid_parameter_value then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000001', true);
do $$
begin
  if (select count(*) from public.coach_applications where status = 'approved' and reviewed_at is not null) <> 1
    or exists (select 1 from public.coach_applications where status = 'rejected') then
    raise exception 'An approved applicant should only see their own decision';
  end if;
end;
$$;

set local role service_role;
do $$
declare
  jobs jsonb;
  application_id uuid := current_setting('test.coach_application_id')::uuid;
  other_id uuid := current_setting('test.other_coach_application_id')::uuid;
begin
  select jsonb_agg(to_jsonb(job)) into jobs from public.claim_coach_application_emails() job;
  if coalesce(jsonb_array_length(jobs), 0) <> 2
    or exists (select 1 from jsonb_array_elements(jobs) job where job->>'attempts' <> '1')
    or exists (select 1 from public.claim_coach_application_emails()) then
    raise exception 'There should be one leased email per application';
  end if;

  perform public.finish_coach_application_emails(jsonb_build_array(
    jsonb_build_object('application_id', application_id, 'attempts', 1, 'retry', true, 'error_code', 'ResendHTTP500'),
    jsonb_build_object('application_id', other_id, 'attempts', 1, 'retry', false, 'error_code', null)
  ));
end;
$$;

reset role;
update private.coach_application_emails set available_at = now()
where application_id = current_setting('test.coach_application_id')::uuid;

set local role service_role;
do $$
declare
  job record;
begin
  select * into job from public.claim_coach_application_emails();
  if job.application_id is distinct from current_setting('test.coach_application_id')::uuid or job.attempts <> 2
    or exists (select 1 from public.claim_coach_application_emails()) then
    raise exception 'Only the email with a temporary error should be retried';
  end if;
  perform public.finish_coach_application_emails(jsonb_build_array(
    jsonb_build_object('application_id', job.application_id, 'attempts', job.attempts, 'error_code', null)
  ));
end;
$$;

reset role;
do $$
begin
  if (select count(*) from private.coach_application_emails where state = 'sent') <> 2 then
    raise exception 'Both email jobs should be complete';
  end if;
end;
$$;

rollback;
