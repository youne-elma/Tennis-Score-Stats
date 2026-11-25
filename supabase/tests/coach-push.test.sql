-- Run after coach-push.sql in a test database. Fixtures are rolled back.
begin;

insert into auth.users (id, email) values
  ('81000000-0000-4000-8000-000000000001', 'push-player@example.invalid'),
  ('81000000-0000-4000-8000-000000000002', 'push-other@example.invalid'),
  ('81000000-0000-4000-8000-000000000003', 'push-coach@example.invalid');

update public.user_roles set role = 'coach' where user_id = '81000000-0000-4000-8000-000000000003';

insert into public.chat_threads (id, created_by, assigned_coach_id) values
  ('82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000003');

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);

select public.register_coach_push_device(auth.uid(), 'ExpoPushToken[test-player-phone]');
select public.register_coach_push_device(auth.uid(), 'ExpoPushToken[test-player-tablet]');

do $$
begin
  if has_function_privilege('authenticated', 'public.claim_coach_push_deliveries()', 'execute')
    or has_function_privilege('authenticated', 'public.finish_coach_push_deliveries(jsonb)', 'execute') then
    raise exception 'An app client can run the notification worker';
  end if;

  begin
    perform public.register_coach_push_device('81000000-0000-4000-8000-000000000002', 'ExpoPushToken[test-wrong-owner]');
    raise exception 'A user can register a device for another account';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

insert into public.chat_messages (thread_id, sender_id, body) values
  ('82000000-0000-4000-8000-000000000001', auth.uid(), 'Player question');

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', true);
select public.register_coach_push_device(auth.uid(), 'ExpoPushToken[test-other-phone]');

do $$
begin
  if (select count(*) from public.coach_push_devices) <> 1 then
    raise exception 'A player can read other accounts'' device registrations';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000003', true);

insert into public.chat_messages (thread_id, sender_id, body) values
  ('82000000-0000-4000-8000-000000000001', auth.uid(), 'Coach reply');

set local role service_role;

do $$
declare
  claimed jsonb;
begin
  select jsonb_agg(to_jsonb(delivery)) into claimed from public.claim_coach_push_deliveries() delivery;
  if coalesce(jsonb_array_length(claimed), 0) <> 2
    or exists (
      select 1 from jsonb_array_elements(claimed) job
      where job->>'recipient_id' <> '81000000-0000-4000-8000-000000000001'
        or job->>'expo_token' not in ('ExpoPushToken[test-player-phone]', 'ExpoPushToken[test-player-tablet]')
    ) then
    raise exception 'The worker must claim only the two devices belonging to the reply recipient';
  end if;

  if exists (select 1 from public.claim_coach_push_deliveries()) then
    raise exception 'A second worker claimed the same leased deliveries';
  end if;

  perform public.finish_coach_push_deliveries((
    select jsonb_agg(jsonb_build_object(
      'id', job->>'id', 'claimed_state', 'pending', 'attempts', (job->>'attempts')::integer,
      'state', 'failed', 'last_error', 'DeviceNotRegistered'
    ))
    from jsonb_array_elements(claimed) job where job->>'expo_token' = 'ExpoPushToken[test-player-tablet]'
  ));
end;
$$;

reset role;

do $$
begin
  if (select count(*) from public.coach_push_deliveries) <> 2 then
    raise exception 'A player message or another conversation queued a push';
  end if;
  if exists (select 1 from public.coach_push_devices where expo_token = 'ExpoPushToken[test-player-tablet]' and active) then
    raise exception 'Expo rejected a token that was left active';
  end if;
end;
$$;

-- A device shared by two accounts does not receive replies queued for the previous owner.
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000003', true);
insert into public.chat_messages (thread_id, sender_id, body) values
  ('82000000-0000-4000-8000-000000000001', auth.uid(), 'Another reply');
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', true);
select public.register_coach_push_device(auth.uid(), 'ExpoPushToken[test-player-phone]');

set local role service_role;

do $$
begin
  if exists (select 1 from public.claim_coach_push_deliveries()) then
    raise exception 'The worker claimed a reply on a device re-registered by another account';
  end if;
end;
$$;

rollback;
