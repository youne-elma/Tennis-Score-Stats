-- Tennis Score Stats coach chat security.
-- Run or re-run this entire file in the Supabase SQL editor after
-- supabase/chat-schema.sql and supabase/user-roles.sql.
-- Existing conversations and messages are not deleted.

begin;

-- Unknown permissive policies could grant access in addition to the rules here.
do $$
declare
  unexpected_policy record;
begin
  select tablename, policyname
  into unexpected_policy
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename in ('chat_threads', 'chat_participants', 'chat_messages')
    and not (
      (tablename = 'chat_threads' and policyname in (
        'chat_threads_select_visible', 'chat_threads_insert_own',
        'chat_threads_update_visible', 'chat_threads_delete_admin'
      ))
      or (tablename = 'chat_participants' and policyname in (
        'chat_participants_select_visible', 'chat_participants_insert_visible',
        'chat_participants_update_visible', 'chat_participants_delete_admin'
      ))
      or (tablename = 'chat_messages' and policyname in (
        'chat_messages_select_visible', 'chat_messages_insert_visible',
        'chat_messages_update_own_or_admin', 'chat_messages_delete_admin'
      ))
    )
  order by tablename, policyname
  limit 1;

  if found then
    raise exception 'Unexpected chat policy "%" on public.%. Review it before applying chat security.',
      unexpected_policy.policyname, unexpected_policy.tablename;
  end if;
end;
$$;

alter table public.chat_threads enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages enable row level security;

revoke all on table public.chat_threads from public, anon, authenticated;
revoke all on table public.chat_participants from public, anon, authenticated;
revoke all on table public.chat_messages from public, anon, authenticated;

-- Table-level REVOKE alone does not remove earlier column-level grants.
revoke all (id, created_by, assigned_coach_id, status, subject, last_message_at, closed_at, created_at, updated_at)
  on public.chat_threads from public, anon, authenticated;
revoke all (thread_id, user_id, participant_role, joined_at, last_read_at)
  on public.chat_participants from public, anon, authenticated;
revoke all (id, thread_id, sender_id, message_type, body, metadata, read_at, created_at, updated_at)
  on public.chat_messages from public, anon, authenticated;

grant select, delete on public.chat_threads to authenticated;
grant insert (created_by, subject), update (status, closed_at)
  on public.chat_threads to authenticated;
grant select, delete on public.chat_participants to authenticated;
grant insert (thread_id, user_id, participant_role), update (last_read_at)
  on public.chat_participants to authenticated;
grant select, delete on public.chat_messages to authenticated;
grant insert (thread_id, sender_id, message_type, body, metadata)
  on public.chat_messages to authenticated;

create schema if not exists private;

-- On upgrade, keep existing coaching relationships using the latest coach reply.
do $$
begin
  if to_regprocedure('private.can_manage_coach_chat()') is not null
    and to_regprocedure('private.can_manage_chat_thread(uuid)') is null then
    with latest_coaches as (
      select distinct on (message.thread_id) message.thread_id, message.sender_id
      from public.chat_messages message
      join public.user_roles author on author.user_id = message.sender_id and author.role = 'coach'
      join public.chat_threads thread on thread.id = message.thread_id and thread.created_by <> message.sender_id
      order by message.thread_id, message.created_at desc, message.id desc
    )
    update public.chat_threads thread set assigned_coach_id = latest_coaches.sender_id
    from latest_coaches where latest_coaches.thread_id = thread.id and thread.assigned_coach_id is null;
  end if;
end;
$$;

-- Participant rows alone never grant access.
create or replace function private.is_chat_thread_owner(target_thread_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.chat_threads thread
    where thread.id = target_thread_id
      and thread.created_by = (select auth.uid())
  );
$$;

create or replace function private.can_manage_chat_thread(target_thread_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select (select private.current_user_role()) = 'admin'
    or (
      (select private.current_user_role()) = 'coach'
      and exists (
        select 1 from public.chat_threads thread
        where thread.id = target_thread_id and thread.assigned_coach_id = (select auth.uid())
      )
    );
$$;

revoke execute on function private.is_chat_thread_owner(uuid) from public;
revoke execute on function private.can_manage_chat_thread(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_chat_thread_owner(uuid) to authenticated;
grant execute on function private.can_manage_chat_thread(uuid) to authenticated;

-- The trigger updates server-managed columns that clients cannot modify.
create or replace function public.handle_chat_message_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.chat_threads
  set last_message_at = greatest(last_message_at, new.created_at)
  where id = new.thread_id;

  return new;
end;
$$;

revoke execute on function public.handle_chat_message_created() from public, anon, authenticated;

drop policy if exists "chat_threads_select_visible" on public.chat_threads;
drop policy if exists "chat_threads_insert_own" on public.chat_threads;
drop policy if exists "chat_threads_update_visible" on public.chat_threads;
drop policy if exists "chat_threads_delete_admin" on public.chat_threads;

create policy "chat_threads_select_visible"
on public.chat_threads for select
to authenticated
using (
  created_by = (select auth.uid())
  or (select private.can_manage_chat_thread(id))
);

create policy "chat_threads_insert_own"
on public.chat_threads for insert
to authenticated
with check (created_by = (select auth.uid()));

create policy "chat_threads_update_visible"
on public.chat_threads for update
to authenticated
using (
  created_by = (select auth.uid())
  or (select private.can_manage_chat_thread(id))
)
with check (
  created_by = (select auth.uid())
  or (select private.can_manage_chat_thread(id))
);

create policy "chat_threads_delete_admin"
on public.chat_threads for delete
to authenticated
using ((select private.current_user_role()) = 'admin');

drop policy if exists "chat_participants_select_visible" on public.chat_participants;
drop policy if exists "chat_participants_insert_visible" on public.chat_participants;
drop policy if exists "chat_participants_update_visible" on public.chat_participants;
drop policy if exists "chat_participants_delete_admin" on public.chat_participants;

create policy "chat_participants_select_visible"
on public.chat_participants for select
to authenticated
using (
  (select private.is_chat_thread_owner(thread_id))
  or (select private.can_manage_chat_thread(thread_id))
);

create policy "chat_participants_insert_visible"
on public.chat_participants for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (
    (
      participant_role = 'user'
      and (select private.is_chat_thread_owner(thread_id))
    )
    or (
      (select private.can_manage_chat_thread(thread_id))
      and participant_role = (select private.current_user_role())
      and exists (
        select 1 from public.chat_threads thread
        where thread.id = chat_participants.thread_id
      )
    )
  )
);

create policy "chat_participants_update_visible"
on public.chat_participants for update
to authenticated
using (
  user_id = (select auth.uid())
  and (
    (select private.is_chat_thread_owner(thread_id))
    or (select private.can_manage_chat_thread(thread_id))
  )
)
with check (
  user_id = (select auth.uid())
  and (
    (select private.is_chat_thread_owner(thread_id))
    or (select private.can_manage_chat_thread(thread_id))
  )
);

create policy "chat_participants_delete_admin"
on public.chat_participants for delete
to authenticated
using ((select private.current_user_role()) = 'admin');

drop policy if exists "chat_messages_select_visible" on public.chat_messages;
drop policy if exists "chat_messages_insert_visible" on public.chat_messages;
drop policy if exists "chat_messages_update_own_or_admin" on public.chat_messages;
drop policy if exists "chat_messages_delete_admin" on public.chat_messages;

create policy "chat_messages_select_visible"
on public.chat_messages for select
to authenticated
using (
  (select private.is_chat_thread_owner(thread_id))
  or (select private.can_manage_chat_thread(thread_id))
);

create policy "chat_messages_insert_visible"
on public.chat_messages for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1
    from public.chat_threads thread
    where thread.id = chat_messages.thread_id
      and thread.status = 'open'
  )
  and (
    (select private.is_chat_thread_owner(thread_id))
    or (select private.can_manage_chat_thread(thread_id))
  )
);

create policy "chat_messages_delete_admin"
on public.chat_messages for delete
to authenticated
using ((select private.current_user_role()) = 'admin');

drop function if exists private.can_manage_coach_chat();

create or replace function public.list_chat_coaches()
returns table (user_id uuid, name text)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if private.current_user_role() <> 'admin' then
    raise exception using errcode = '42501', message = 'An administrator is required.';
  end if;
  return query
  select coach.user_id, coalesce(nullif(btrim(profile.display_name), ''), account.email, 'Coach')
  from public.user_roles coach
  join auth.users account on account.id = coach.user_id
  left join public.profiles profile on profile.id = coach.user_id
  where coach.role = 'coach'
  order by 2, coach.user_id;
end;
$$;

create or replace function public.assign_chat_coach(p_thread_id uuid, p_coach_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_user_role() <> 'admin' then
    raise exception using errcode = '42501', message = 'An administrator is required.';
  end if;
  if p_coach_id is not null then
    perform 1 from public.user_roles where user_id = p_coach_id and role = 'coach' for share;
    if not found then
      raise exception using errcode = '22023', message = 'Choose an active coach.';
    end if;
  end if;

  update public.chat_threads set assigned_coach_id = p_coach_id
  where id = p_thread_id and created_by is distinct from p_coach_id;
  if not found then
    raise exception using errcode = '22023', message = 'Choose another coach for this conversation.';
  end if;
end;
$$;

revoke all on function public.list_chat_coaches() from public, anon, authenticated;
revoke all on function public.assign_chat_coach(uuid, uuid) from public, anon, authenticated;
grant execute on function public.list_chat_coaches() to authenticated;
grant execute on function public.assign_chat_coach(uuid, uuid) to authenticated;

commit;
