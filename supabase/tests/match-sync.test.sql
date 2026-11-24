-- Run after match-sync.sql in a test database. Fixtures are rolled back.
begin;

insert into auth.users (id, email) values
  ('83000000-0000-4000-8000-000000000001', 'sync-owner@example.invalid'),
  ('83000000-0000-4000-8000-000000000002', 'sync-other@example.invalid');

insert into public.players (id, user_id, first_name, last_name, gender, handedness, birthday_date) values
  ('83100000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000001', 'First', 'Player', 'Other', 'Right-handed', '1990-01-01'),
  ('83100000-0000-4000-8000-000000000002', '83000000-0000-4000-8000-000000000001', 'Second', 'Player', 'Other', 'Left-handed', '1990-01-01');

set local role authenticated;
select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000001', true);

do $$
declare
  owner_id uuid := auth.uid();
  match_id uuid := '83200000-0000-4000-8000-000000000001';
  request_id uuid := gen_random_uuid();
  event_id uuid := gen_random_uuid();
  second_event uuid := gen_random_uuid();
  legacy_event uuid := gen_random_uuid();
  draft jsonb := jsonb_build_object(
    'id', match_id, 'player1_id', '83100000-0000-4000-8000-000000000001',
    'player2_id', '83100000-0000-4000-8000-000000000002', 'initial_server_id', '83100000-0000-4000-8000-000000000001',
    'number_of_sets', '1', 'games_per_set', '4', 'use_tiebreaks', true, 'tiebreak_type', 'Standard 7 points',
    'deuce_scoring', 'Advantage (Long Deuce)', 'court_view', 'Behind Baseline', 'status', 'Ended',
    'created_at', '2026-01-01T10:00:00Z', 'ended_at', '2026-01-01T11:00:00Z'
  );
  events jsonb := jsonb_build_array(
    jsonb_build_object('id', event_id, 'server_id', draft->>'player1_id', 'phase', 'First Serve',
      'action', 'Ace', 'serve_type', 'Flat', 'zone', 'Wide', 'created_at', '2026-01-01T10:00:02Z'),
    jsonb_build_object('id', second_event, 'server_id', draft->>'player1_id', 'phase', 'First Serve',
      'action', 'Ace', 'serve_type', 'Slice', 'zone', 'To the body', 'created_at', '2026-01-01T10:00:01Z')
  );
  result jsonb;
  revision bigint;
  saved_events jsonb;
begin
  result := public.sync_account_match(owner_id, request_id, null, draft, events);
  if result->>'status' is distinct from 'synced' then
    raise exception 'New offline match did not sync';
  end if;
  revision := (result->>'revision')::bigint;

  if public.sync_account_match(owner_id, request_id, null, draft, events) is distinct from result
    or (select count(*) from public.service_events event where event.match_id = (draft->>'id')::uuid) <> 2 then
    raise exception 'Retrying a committed upload changed the match';
  end if;

  select page.events into saved_events from public.page_account_matches(owner_id) page;
  if saved_events->0->>'id' is distinct from event_id::text
    or saved_events->1->>'id' is distinct from second_event::text then
    raise exception 'Reading a synced match reordered its serves by timestamp';
  end if;

  -- Older app versions still insert directly and increment the match revision.
  insert into public.service_events (id, user_id, match_id, server_id, phase, action, serve_type, zone)
  values (legacy_event, owner_id, match_id, (draft->>'player1_id')::uuid, 'First Serve', 'Ace', 'Flat', 'Wide');
  if (select event_order from public.service_events where id = legacy_event) <> 3 then
    raise exception 'An older client could not append a serve';
  end if;

  result := public.sync_account_match(owner_id, gen_random_uuid(), revision, draft, events);
  if result->>'status' is distinct from 'conflict'
    or result->'remote'->'events'->2->>'id' is distinct from legacy_event::text then
    raise exception 'A stale upload erased an online change';
  end if;
  revision := (result->'remote'->'match'->>'sync_revision')::bigint;

  begin
    perform public.sync_account_match(owner_id, gen_random_uuid(), revision, draft,
      jsonb_build_array(jsonb_set(events->0, '{action}', '"Invalid"'::jsonb)));
    raise exception 'An invalid upload should fail';
  exception when check_violation then
    null;
  end;
  if (select count(*) from public.service_events event where event.match_id = (draft->>'id')::uuid) <> 3 then
    raise exception 'A failed upload changed existing events';
  end if;

  result := public.sync_account_match(owner_id, gen_random_uuid(), revision, draft,
    jsonb_build_array(jsonb_set(events->1, '{zone}', '"Wide"'::jsonb)));
  select page.events into saved_events from public.page_account_matches(owner_id) page;
  if result->>'status' is distinct from 'synced' or jsonb_array_length(saved_events) <> 1
    or saved_events->0->>'id' is distinct from second_event::text
    or saved_events->0->>'zone' is distinct from 'Wide' then
    raise exception 'Choosing the device version did not keep its edited and removed serves';
  end if;

  update public.players set archived_at = now() where id = (draft->>'player1_id')::uuid;
  result := public.sync_account_match(owner_id, gen_random_uuid(), null,
    jsonb_set(draft, '{id}', to_jsonb(gen_random_uuid())), events);
  if result->>'reason' is distinct from 'archived-player' then
    raise exception 'An archived player was accepted for a new match';
  end if;

  perform set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000002', true);
  if exists (select 1 from public.page_account_matches(auth.uid()))
    or exists (select 1 from public.match_sync_receipts) then
    raise exception 'A different account can read match history or upload receipts';
  end if;
  begin
    perform public.page_account_matches(owner_id);
    raise exception 'A different account can request someone else''s history';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.sync_account_match(owner_id, gen_random_uuid(), null, draft, events);
    raise exception 'A different account can sync the match';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

rollback;
