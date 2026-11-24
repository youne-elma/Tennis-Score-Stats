-- Apply after user-roles.sql and chat-rls.sql.
begin;

create table if not exists public.coach_push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  expo_token text not null unique,
  active boolean not null default true,
  registered_at timestamptz not null default clock_timestamp()
);

create index if not exists coach_push_devices_active_user_idx
  on public.coach_push_devices (user_id) where active;

create table if not exists public.coach_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  device_id uuid not null references public.coach_push_devices (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  state text not null default 'pending'
    check (state in ('pending', 'submitted', 'sent', 'cancelled', 'failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  device_registered_at timestamptz,
  ticket_id text,
  last_error text,
  unique (message_id, device_id)
);

create index if not exists coach_push_deliveries_due_idx
  on public.coach_push_deliveries (available_at) where state in ('pending', 'submitted');

alter table public.coach_push_devices enable row level security;
alter table public.coach_push_deliveries enable row level security;

revoke all on public.coach_push_devices, public.coach_push_deliveries from public, anon, authenticated;
grant select, delete on public.coach_push_devices to authenticated;

drop policy if exists "coach_push_devices_select_own" on public.coach_push_devices;
create policy "coach_push_devices_select_own"
on public.coach_push_devices for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "coach_push_devices_delete_own" on public.coach_push_devices;
create policy "coach_push_devices_delete_own"
on public.coach_push_devices for delete to authenticated
using (user_id = (select auth.uid()));

create or replace function public.register_coach_push_device(
  p_user_id uuid,
  p_expo_token text,
  p_previous_token text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or actor_id is distinct from p_user_id then
    raise exception using errcode = '42501', message = 'The signed-in account changed.';
  end if;
  if p_expo_token is null or length(p_expo_token) > 256
    or p_expo_token !~ '^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$' then
    raise exception using errcode = '22023', message = 'Invalid Expo push token.';
  end if;

  insert into public.coach_push_devices (user_id, expo_token)
  values (actor_id, p_expo_token)
  on conflict (expo_token) do update
    set user_id = excluded.user_id, active = true, registered_at = clock_timestamp();

  delete from public.coach_push_devices
  where user_id = actor_id and expo_token = p_previous_token and expo_token <> p_expo_token;
end;
$$;

revoke all on function public.register_coach_push_device(uuid, text, text) from public, anon, authenticated;
grant execute on function public.register_coach_push_device(uuid, text, text) to authenticated;

create or replace function private.enqueue_coach_reply_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.coach_push_deliveries (message_id, device_id, recipient_id)
  select new.id, device.id, thread.created_by
  from public.chat_threads thread
  join public.user_roles sender on sender.user_id = new.sender_id and sender.role in ('coach', 'admin')
  join public.coach_push_devices device on device.user_id = thread.created_by and device.active
  where thread.id = new.thread_id and thread.created_by <> new.sender_id
  on conflict (message_id, device_id) do nothing;

  return new;
end;
$$;

revoke all on function private.enqueue_coach_reply_push() from public, anon, authenticated;
drop trigger if exists chat_messages_enqueue_coach_reply_push on public.chat_messages;
create trigger chat_messages_enqueue_coach_reply_push
  after insert on public.chat_messages
  for each row execute function private.enqueue_coach_reply_push();

create or replace function public.claim_coach_push_deliveries()
returns table (
  id uuid,
  state text,
  attempts integer,
  expo_token text,
  recipient_id uuid,
  thread_id uuid,
  ticket_id text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Skip replies already read and devices that now belong to another account.
  update public.coach_push_deliveries delivery set state = 'cancelled'
  where delivery.state = 'pending' and delivery.available_at <= now()
    and not exists (
      select 1
      from public.chat_messages message
      join public.coach_push_devices device
        on device.id = delivery.device_id and device.user_id = delivery.recipient_id and device.active
      left join public.chat_participants participant
        on participant.thread_id = message.thread_id and participant.user_id = delivery.recipient_id
      where message.id = delivery.message_id
        and (participant.last_read_at is null or participant.last_read_at < message.created_at)
    );

  update public.coach_push_deliveries delivery
  set state = 'failed', last_error = coalesce(delivery.last_error, 'RetryLimit')
  where delivery.state in ('pending', 'submitted') and delivery.available_at <= now() and delivery.attempts >= 6;

  return query
  with jobs as (
    select delivery.id, device.expo_token, device.registered_at, message.thread_id
    from public.coach_push_deliveries delivery
    join public.coach_push_devices device on device.id = delivery.device_id
    join public.chat_messages message on message.id = delivery.message_id
    left join public.chat_participants participant
      on participant.thread_id = message.thread_id and participant.user_id = delivery.recipient_id
    where delivery.state in ('pending', 'submitted') and delivery.available_at <= now()
      and (
        delivery.state = 'submitted'
        or (
          device.active and device.user_id = delivery.recipient_id
          and (participant.last_read_at is null or participant.last_read_at < message.created_at)
        )
      )
    order by delivery.available_at, delivery.id
    limit 100
    for update of delivery skip locked
  )
  update public.coach_push_deliveries delivery
  set attempts = delivery.attempts + 1,
      available_at = now() + interval '2 minutes',
      device_registered_at = case
        when delivery.state = 'pending' then jobs.registered_at else delivery.device_registered_at end
  from jobs
  where delivery.id = jobs.id
  returning delivery.id, delivery.state, delivery.attempts, jobs.expo_token, delivery.recipient_id,
    jobs.thread_id, delivery.ticket_id;
end;
$$;

create or replace function public.finish_coach_push_deliveries(p_results jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  with updated as (
    update public.coach_push_deliveries delivery
    set state = result.state,
        attempts = case when delivery.state = 'pending' and result.state = 'submitted'
          then 0 else delivery.attempts end,
        available_at = coalesce(result.available_at, delivery.available_at),
        ticket_id = coalesce(result.ticket_id, delivery.ticket_id),
        last_error = result.last_error
    from jsonb_to_recordset(p_results) as result(
      id uuid, claimed_state text, attempts integer, state text,
      available_at timestamptz, ticket_id text, last_error text
    )
    where delivery.id = result.id and delivery.state = result.claimed_state and delivery.attempts = result.attempts
    returning delivery.device_id, delivery.recipient_id, delivery.device_registered_at, delivery.last_error
  )
  update public.coach_push_devices device set active = false
  from updated
  where updated.last_error = 'DeviceNotRegistered' and device.id = updated.device_id
    and device.user_id = updated.recipient_id and device.registered_at = updated.device_registered_at;
$$;

revoke all on function public.claim_coach_push_deliveries() from public, anon, authenticated;
revoke all on function public.finish_coach_push_deliveries(jsonb) from public, anon, authenticated;
grant execute on function public.claim_coach_push_deliveries() to service_role;
grant execute on function public.finish_coach_push_deliveries(jsonb) to service_role;

commit;
