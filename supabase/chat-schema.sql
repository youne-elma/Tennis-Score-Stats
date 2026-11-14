-- Tennis Score Stats coach chat schema.
-- Run this after supabase/schema.sql and supabase/user-roles.sql.
-- Run supabase/chat-rls.sql after this file to configure access policies.

create extension if not exists pgcrypto;

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,
  assigned_coach_id uuid references auth.users (id) on delete set null,
  status text not null default 'open',
  subject text,
  last_message_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_threads_status_check check (status in ('open', 'closed'))
);

create table if not exists public.chat_participants (
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  participant_role text not null default 'user',
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (thread_id, user_id),
  constraint chat_participants_role_check check (participant_role in ('user', 'coach', 'admin'))
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  message_type text not null default 'text',
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_messages_type_check check (message_type in ('text', 'match_stats')),
  constraint chat_messages_body_not_blank_check check (length(trim(body)) > 0)
);

-- Deny client access until the policies in chat-rls.sql have been installed.
alter table public.chat_threads enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages enable row level security;

create index if not exists chat_threads_created_by_idx on public.chat_threads (created_by);
create index if not exists chat_threads_assigned_coach_id_idx on public.chat_threads (assigned_coach_id);
create index if not exists chat_threads_status_idx on public.chat_threads (status);
create index if not exists chat_threads_last_message_at_idx on public.chat_threads (last_message_at desc);

create index if not exists chat_participants_user_id_idx on public.chat_participants (user_id);
create index if not exists chat_participants_participant_role_idx on public.chat_participants (participant_role);

create index if not exists chat_messages_thread_id_created_at_idx on public.chat_messages (thread_id, created_at);
create index if not exists chat_messages_sender_id_idx on public.chat_messages (sender_id);

create or replace function public.handle_chat_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists chat_threads_set_updated_at on public.chat_threads;
drop trigger if exists chat_messages_set_updated_at on public.chat_messages;

create trigger chat_threads_set_updated_at
before update on public.chat_threads
for each row
execute function public.handle_chat_updated_at();

create trigger chat_messages_set_updated_at
before update on public.chat_messages
for each row
execute function public.handle_chat_updated_at();

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

drop trigger if exists chat_messages_update_thread_last_message on public.chat_messages;

create trigger chat_messages_update_thread_last_message
after insert on public.chat_messages
for each row
execute function public.handle_chat_message_created();
