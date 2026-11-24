-- Apply after schema.sql, rls.sql, and player-archive.sql.
begin;

alter table public.matches add column if not exists sync_revision bigint not null default 0;
alter table public.service_events add column if not exists event_order integer;

with ordered as (
  select id, row_number() over (partition by match_id order by created_at, id) as position
  from public.service_events
)
update public.service_events event set event_order = ordered.position
from ordered where ordered.id = event.id and event.event_order is null;

alter table public.service_events alter column event_order set not null;
create index if not exists service_events_match_order_idx on public.service_events (match_id, event_order);

create table if not exists public.match_sync_receipts (
  user_id uuid not null references auth.users (id) on delete cascade,
  match_id uuid not null,
  request_id uuid not null,
  revision bigint not null,
  primary key (user_id, match_id, request_id)
);

alter table public.match_sync_receipts enable row level security;
revoke all on public.match_sync_receipts from public, anon, authenticated;
grant select, insert on public.match_sync_receipts to authenticated;

drop policy if exists "match_sync_receipts_select_own" on public.match_sync_receipts;
create policy "match_sync_receipts_select_own" on public.match_sync_receipts
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "match_sync_receipts_insert_own" on public.match_sync_receipts;
create policy "match_sync_receipts_insert_own" on public.match_sync_receipts
for insert to authenticated with check (user_id = (select auth.uid()));

create schema if not exists private;

create or replace function private.advance_match_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.sync_revision := case when tg_op = 'INSERT' then 0 else old.sync_revision + 1 end;
  return new;
end;
$$;

drop trigger if exists advance_match_revision on public.matches;
create trigger advance_match_revision before insert or update on public.matches
for each row execute function private.advance_match_revision();

create or replace function private.assign_service_event_order()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Earlier app versions insert events without a position.
  if new.event_order is null then
    perform 1 from public.matches where id = new.match_id for update;
    select coalesce(max(event_order), 0) + 1 into new.event_order
    from public.service_events where match_id = new.match_id;
  end if;
  return new;
end;
$$;

drop trigger if exists assign_service_event_order on public.service_events;
create trigger assign_service_event_order before insert on public.service_events
for each row execute function private.assign_service_event_order();

create or replace function private.advance_match_event_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    update public.matches set updated_at = now() where id = new.match_id;
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.match_id <> new.match_id) then
    update public.matches set updated_at = now() where id = old.match_id;
  end if;
  return null;
end;
$$;

drop trigger if exists advance_match_event_revision on public.service_events;
create trigger advance_match_event_revision after insert or update or delete on public.service_events
for each row execute function private.advance_match_event_revision();

create or replace function public.sync_account_match(
  p_account_id uuid,
  p_request_id uuid,
  p_expected_revision bigint,
  p_match jsonb,
  p_events jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  incoming public.matches := jsonb_populate_record(null::public.matches, p_match);
  stored public.matches;
  synced_revision bigint;
begin
  if actor_id is null or actor_id is distinct from p_account_id then
    raise exception using errcode = '42501', message = 'The signed-in account changed.';
  end if;
  if incoming.id is null or p_request_id is null or jsonb_typeof(p_events) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Invalid match sync request.';
  end if;

  -- Serialize requests for this match, including its first upload from offline storage.
  perform pg_advisory_xact_lock(hashtextextended(incoming.id::text, 0));
  select revision into synced_revision from public.match_sync_receipts
  where user_id = actor_id and match_id = incoming.id and request_id = p_request_id;
  if found then
    return jsonb_build_object('status', 'synced', 'revision', synced_revision);
  end if;

  select * into stored from public.matches
  where id = incoming.id and user_id = actor_id for update;

  if stored.sync_revision is distinct from p_expected_revision then
    return jsonb_build_object('status', 'conflict', 'remote',
      case when stored.id is null then null else jsonb_build_object(
        'match', to_jsonb(stored),
        'events', coalesce((
          select jsonb_agg(to_jsonb(event) order by event.event_order)
          from public.service_events event where event.match_id = stored.id
        ), '[]'::jsonb)
      ) end
    );
  end if;

  if stored.id is null then
    if exists (
      select 1 from public.players where id in (incoming.player1_id, incoming.player2_id) and archived_at is not null
    ) then
      return jsonb_build_object('status', 'blocked', 'reason', 'archived-player');
    end if;
    insert into public.matches (
      id, user_id, player1_id, player2_id, initial_server_id, number_of_sets, games_per_set,
      use_tiebreaks, tiebreak_type, deuce_scoring, court_view, status, pause_reason, ended_at, created_at
    ) values (
      incoming.id, actor_id, incoming.player1_id, incoming.player2_id, incoming.initial_server_id,
      incoming.number_of_sets, incoming.games_per_set, incoming.use_tiebreaks, incoming.tiebreak_type,
      incoming.deuce_scoring, incoming.court_view, incoming.status, incoming.pause_reason,
      incoming.ended_at, incoming.created_at
    );
  else
    update public.matches set
      player1_id = incoming.player1_id, player2_id = incoming.player2_id, initial_server_id = incoming.initial_server_id,
      number_of_sets = incoming.number_of_sets, games_per_set = incoming.games_per_set,
      use_tiebreaks = incoming.use_tiebreaks, tiebreak_type = incoming.tiebreak_type,
      deuce_scoring = incoming.deuce_scoring, court_view = incoming.court_view, status = incoming.status,
      pause_reason = incoming.pause_reason, ended_at = incoming.ended_at, updated_at = now()
    where id = incoming.id and user_id = actor_id;
  end if;

  if exists (
    select 1 from jsonb_populate_recordset(null::public.service_events, p_events) event
    where event.server_id not in (incoming.player1_id, incoming.player2_id)
      or (event.point_winner_id is not null and event.point_winner_id not in (incoming.player1_id, incoming.player2_id))
  ) then
    raise exception using errcode = '22023', message = 'Every service event must belong to a match player.';
  end if;

  delete from public.service_events previous
  where previous.match_id = incoming.id and previous.user_id = actor_id
    and not exists (
      select 1 from jsonb_populate_recordset(null::public.service_events, p_events) event
      where event.id = previous.id
    );

  insert into public.service_events as previous (
    id, user_id, match_id, event_order, created_at, server_id, phase, action, serve_type, zone, fault_type, point_winner_id
  )
  select event.id, actor_id, incoming.id, item.position, event.created_at, event.server_id, event.phase, event.action,
    event.serve_type, event.zone, event.fault_type, event.point_winner_id
  from jsonb_array_elements(p_events) with ordinality as item(value, position)
  cross join lateral jsonb_populate_record(null::public.service_events, item.value) event
  on conflict (id) do update set
    server_id = excluded.server_id, phase = excluded.phase, action = excluded.action, serve_type = excluded.serve_type,
    zone = excluded.zone, fault_type = excluded.fault_type, point_winner_id = excluded.point_winner_id,
    event_order = excluded.event_order, updated_at = now()
  where previous.match_id = excluded.match_id and previous.user_id = excluded.user_id
    and (previous.server_id, previous.phase, previous.action, previous.serve_type, previous.zone,
      previous.fault_type, previous.point_winner_id, previous.event_order) is distinct from (
      excluded.server_id, excluded.phase, excluded.action, excluded.serve_type, excluded.zone,
      excluded.fault_type, excluded.point_winner_id, excluded.event_order
    );

  if (select count(*) from public.service_events where match_id = incoming.id) <> jsonb_array_length(p_events) then
    raise exception using errcode = '22023', message = 'Service event IDs must be unique to this match.';
  end if;

  select sync_revision into synced_revision from public.matches where id = incoming.id;
  insert into public.match_sync_receipts (user_id, match_id, request_id, revision)
  values (actor_id, incoming.id, p_request_id, synced_revision);

  return jsonb_build_object('status', 'synced', 'revision', synced_revision);
end;
$$;

revoke all on function public.sync_account_match(uuid, uuid, bigint, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.sync_account_match(uuid, uuid, bigint, jsonb, jsonb) to authenticated;

create or replace function public.page_account_matches(
  p_account_id uuid,
  p_after_created_at timestamptz default null,
  p_after_id uuid default null
)
returns table (match_row jsonb, events jsonb)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_account_id then
    raise exception using errcode = '42501', message = 'The signed-in account changed.';
  end if;

  return query select to_jsonb(match), coalesce((
    select jsonb_agg(to_jsonb(event) order by event.event_order, event.id)
    from public.service_events event where event.match_id = match.id
  ), '[]'::jsonb)
  from public.matches match
  where match.user_id = p_account_id and match.user_id = (select auth.uid())
    and (p_after_created_at is null or (match.created_at, match.id) > (p_after_created_at, p_after_id))
  order by match.created_at, match.id
  limit 40;
end;
$$;

revoke all on function public.page_account_matches(uuid, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.page_account_matches(uuid, timestamptz, uuid) to authenticated;

commit;
