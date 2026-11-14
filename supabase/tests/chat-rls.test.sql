-- Run after chat-rls.sql as a database administrator, preferably on a test
-- project. All fixture data and changes are rolled back at the end.
begin;

insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'chat-rls-alice@example.invalid'),
  ('10000000-0000-4000-8000-000000000002', 'chat-rls-bob@example.invalid'),
  ('10000000-0000-4000-8000-000000000003', 'chat-rls-charlie@example.invalid'),
  ('10000000-0000-4000-8000-000000000004', 'chat-rls-coach@example.invalid'),
  ('10000000-0000-4000-8000-000000000005', 'chat-rls-admin@example.invalid');

insert into public.user_roles (user_id, role) values
  ('10000000-0000-4000-8000-000000000001', 'user'),
  ('10000000-0000-4000-8000-000000000002', 'user'),
  ('10000000-0000-4000-8000-000000000003', 'user'),
  ('10000000-0000-4000-8000-000000000004', 'coach'),
  ('10000000-0000-4000-8000-000000000005', 'admin')
on conflict (user_id) do update set role = excluded.role;

insert into public.chat_threads (id, created_by, assigned_coach_id) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', null),
  -- An old assignment to an ordinary user must not grant that user access.
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', null);

insert into public.chat_participants (thread_id, user_id, participant_role) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'user'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'user'),
  -- Simulate a row left by the previous vulnerable policies.
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'user');

insert into public.chat_messages (id, thread_id, sender_id, body) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Alice message'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Bob message');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

do $$
declare
  attack text;
  new_thread_id uuid;
begin
  if (select count(*) from public.chat_threads) <> 1
    or (select count(*) from public.chat_messages) <> 1
    or (select count(*) from public.chat_participants) <> 1 then
    raise exception 'A user can see another conversation, including through an old participant row';
  end if;

  foreach attack in array array[
    $q$update public.chat_participants set thread_id = '20000000-0000-4000-8000-000000000003' where user_id = '10000000-0000-4000-8000-000000000001'$q$,
    $q$update public.chat_participants set user_id = '10000000-0000-4000-8000-000000000002' where thread_id = '20000000-0000-4000-8000-000000000001'$q$,
    $q$insert into public.chat_participants (thread_id, user_id, participant_role) values ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'user')$q$,
    $q$insert into public.chat_participants (thread_id, user_id, participant_role) values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'user')$q$,
    $q$insert into public.chat_threads (created_by, subject) values ('10000000-0000-4000-8000-000000000002', 'impersonation')$q$,
    $q$insert into public.chat_threads (created_by, assigned_coach_id) values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002')$q$,
    $q$update public.chat_threads set assigned_coach_id = '10000000-0000-4000-8000-000000000001' where id = '20000000-0000-4000-8000-000000000001'$q$,
    $q$update public.chat_threads set created_by = '10000000-0000-4000-8000-000000000002' where id = '20000000-0000-4000-8000-000000000001'$q$,
    $q$update public.chat_messages set thread_id = '20000000-0000-4000-8000-000000000002' where id = '30000000-0000-4000-8000-000000000001'$q$,
    $q$update public.chat_messages set body = 'changed' where id = '30000000-0000-4000-8000-000000000001'$q$,
    $q$insert into public.chat_messages (thread_id, sender_id, body) values ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'intrusion')$q$,
    $q$insert into public.chat_messages (thread_id, sender_id, body) values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'impersonation')$q$
  ] loop
    begin
      execute attack;
      raise exception 'Unauthorized statement succeeded: %', attack;
    exception when insufficient_privilege then
      null;
    end;
  end loop;

  update public.chat_participants set last_read_at = now()
  where thread_id = '20000000-0000-4000-8000-000000000001'
    and user_id = '10000000-0000-4000-8000-000000000001';
  if not found then
    raise exception 'The owner cannot update their own read status';
  end if;

  insert into public.chat_messages (thread_id, sender_id, body)
  values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Allowed message');

  if (select last_message_at from public.chat_threads where id = '20000000-0000-4000-8000-000000000001') is null then
    raise exception 'Sending a message did not update the conversation timestamp';
  end if;

  insert into public.chat_threads (created_by, subject)
  values ('10000000-0000-4000-8000-000000000001', 'New conversation')
  returning id into new_thread_id;
  insert into public.chat_participants (thread_id, user_id, participant_role)
  values (new_thread_id, '10000000-0000-4000-8000-000000000001', 'user');
  insert into public.chat_messages (thread_id, sender_id, body)
  values (new_thread_id, '10000000-0000-4000-8000-000000000001', 'First message');
  if (select last_message_at from public.chat_threads where id = new_thread_id) is null then
    raise exception 'A newly created conversation cannot receive a message';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.chat_threads) <> 4
    or (select count(*) from public.chat_messages) <> 4 then
    raise exception 'A coach cannot see the conversations they are meant to manage';
  end if;

  insert into public.chat_participants (thread_id, user_id, participant_role)
  values ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', 'coach');
  update public.chat_participants set last_read_at = now()
  where thread_id = '20000000-0000-4000-8000-000000000002'
    and user_id = '10000000-0000-4000-8000-000000000004';
  if not found then
    raise exception 'A coach cannot update their own read status';
  end if;

  begin
    insert into public.chat_participants (thread_id, user_id, participant_role)
    values ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', 'user');
    raise exception 'A coach added a different user to a private conversation';
  exception when insufficient_privilege then
    null;
  end;

  insert into public.chat_messages (thread_id, sender_id, body)
  values ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', 'Coach reply');
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.chat_messages) <> 2 then
    raise exception 'The user cannot see the coach reply';
  end if;
  update public.chat_threads set status = 'closed', closed_at = now()
  where id = '20000000-0000-4000-8000-000000000002';
  if not found then
    raise exception 'The owner cannot close their conversation';
  end if;
  begin
    insert into public.chat_messages (thread_id, sender_id, body)
    values ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Closed conversation');
    raise exception 'A message was sent to a closed conversation';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000005', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.chat_threads) <> 4 then
    raise exception 'An admin cannot see the conversations they are meant to manage';
  end if;
  delete from public.chat_messages where id = '30000000-0000-4000-8000-000000000002';
  if not found then
    raise exception 'An admin cannot delete a message';
  end if;
end;
$$;

reset role;
set local role anon;
do $$
begin
  begin
    perform 1 from public.chat_messages;
    raise exception 'Anonymous users can read chat messages';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

rollback;
