-- Tennis Score Stats coach chat Row Level Security policies.
-- Run this after supabase/chat-schema.sql and supabase/user-roles.sql.

alter table public.chat_threads enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages enable row level security;

revoke all on table public.chat_threads from anon, authenticated;
revoke all on table public.chat_participants from anon, authenticated;
revoke all on table public.chat_messages from anon, authenticated;

grant select, insert, update, delete on table public.chat_threads to authenticated;
grant select, insert, update, delete on table public.chat_participants to authenticated;
grant select, insert, update, delete on table public.chat_messages to authenticated;

create schema if not exists private;

create or replace function private.is_chat_participant(target_thread_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.chat_participants participant
    where participant.thread_id = target_thread_id
      and participant.user_id = (select auth.uid())
  );
$$;

create or replace function private.can_manage_coach_chat()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select (select private.current_user_role()) in ('coach', 'admin');
$$;

revoke execute on function private.is_chat_participant(uuid) from public;
revoke execute on function private.can_manage_coach_chat() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_chat_participant(uuid) to authenticated;
grant execute on function private.can_manage_coach_chat() to authenticated;

drop policy if exists "chat_threads_select_visible" on public.chat_threads;
drop policy if exists "chat_threads_insert_own" on public.chat_threads;
drop policy if exists "chat_threads_update_visible" on public.chat_threads;
drop policy if exists "chat_threads_delete_admin" on public.chat_threads;

create policy "chat_threads_select_visible"
on public.chat_threads for select
to authenticated
using (
  created_by = (select auth.uid())
  or assigned_coach_id = (select auth.uid())
  or (select private.is_chat_participant(id))
  or (select private.can_manage_coach_chat())
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
  or assigned_coach_id = (select auth.uid())
  or (select private.can_manage_coach_chat())
)
with check (
  created_by = (select auth.uid())
  or assigned_coach_id = (select auth.uid())
  or (select private.can_manage_coach_chat())
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
  user_id = (select auth.uid())
  or (select private.is_chat_participant(thread_id))
  or (select private.can_manage_coach_chat())
);

create policy "chat_participants_insert_visible"
on public.chat_participants for insert
to authenticated
with check (
  (
    user_id = (select auth.uid())
    and participant_role = 'user'
    and exists (
      select 1
      from public.chat_threads thread
      where thread.id = chat_participants.thread_id
        and thread.created_by = (select auth.uid())
    )
  )
  or (select private.can_manage_coach_chat())
);

create policy "chat_participants_update_visible"
on public.chat_participants for update
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.can_manage_coach_chat())
)
with check (
  (
    user_id = (select auth.uid())
    and participant_role = 'user'
  )
  or (select private.can_manage_coach_chat())
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
  (select private.is_chat_participant(thread_id))
  or (select private.can_manage_coach_chat())
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
    (select private.is_chat_participant(thread_id))
    or (select private.can_manage_coach_chat())
  )
);

create policy "chat_messages_update_own_or_admin"
on public.chat_messages for update
to authenticated
using (
  sender_id = (select auth.uid())
  or (select private.can_manage_coach_chat())
)
with check (
  sender_id = (select auth.uid())
  or (select private.can_manage_coach_chat())
);

create policy "chat_messages_delete_admin"
on public.chat_messages for delete
to authenticated
using ((select private.current_user_role()) = 'admin');
