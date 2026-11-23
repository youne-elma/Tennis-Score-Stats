-- Run after player-archive.sql in a test database. Fixtures are rolled back.
begin;

insert into auth.users (id, email) values
  ('41000000-0000-4000-8000-000000000001', 'player-archive-test@example.invalid');

insert into public.players (id, user_id, first_name, last_name, gender, handedness, birthday_date) values
  ('42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 'Alex', 'Archive', 'Other', 'Right-handed', '1990-01-01'),
  ('42000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000001', 'Riley', 'Active', 'Other', 'Right-handed', '1990-01-01'),
  ('42000000-0000-4000-8000-000000000003', '41000000-0000-4000-8000-000000000001', 'Morgan', 'Active', 'Other', 'Right-handed', '1990-01-01');

insert into public.matches (
  id, user_id, player1_id, player2_id, initial_server_id, number_of_sets, games_per_set,
  tiebreak_type, deuce_scoring, court_view
) values (
  '43000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001',
  '42000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000002',
  '42000000-0000-4000-8000-000000000002', '3', '6', 'Standard 7 points',
  'Advantage (Long Deuce)', 'Behind Baseline'
);

insert into public.service_events (user_id, match_id, server_id, phase, action, serve_type, zone) values (
  '41000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001',
  '42000000-0000-4000-8000-000000000002', 'First Serve', 'Ace', 'Flat', 'Wide'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);

do $$
declare
  retired_player constant uuid := '42000000-0000-4000-8000-000000000001';
  active_player constant uuid := '42000000-0000-4000-8000-000000000002';
  second_active_player constant uuid := '42000000-0000-4000-8000-000000000003';
  existing_match constant uuid := '43000000-0000-4000-8000-000000000001';
begin
  update public.players set archived_at = now() where id = retired_player;
  if not exists (select 1 from public.players where id = retired_player and archived_at is not null) then
    raise exception 'The owner cannot archive and read their player';
  end if;

  begin
    delete from public.players where id = retired_player;
    raise exception 'Deleting the first player would remove match history';
  exception when foreign_key_violation then
    null;
  end;

  update public.matches set player1_id = active_player, player2_id = retired_player, status = 'In progress'
  where id = existing_match;
  if not found then
    raise exception 'The owner cannot update their existing match after archiving';
  end if;

  begin
    delete from public.players where id = retired_player;
    raise exception 'Deleting the second player would remove match history';
  exception when foreign_key_violation then
    null;
  end;

  if (select count(*) from public.service_events where match_id = existing_match) <> 1 then
    raise exception 'Archiving a player must preserve the existing service events';
  end if;

  begin
    insert into public.matches (
      user_id, player1_id, player2_id, initial_server_id, number_of_sets, games_per_set,
      tiebreak_type, deuce_scoring, court_view
    ) values (
      auth.uid(), active_player, retired_player, active_player, '3', '6', 'Standard 7 points',
      'Advantage (Long Deuce)', 'Behind Baseline'
    );
    raise exception 'A new match accepted an archived player';
  exception when insufficient_privilege then
    null;
  end;

  insert into public.matches (
    user_id, player1_id, player2_id, initial_server_id, number_of_sets, games_per_set,
    tiebreak_type, deuce_scoring, court_view
  ) values (
    auth.uid(), active_player, second_active_player, active_player, '3', '6', 'Standard 7 points',
    'Advantage (Long Deuce)', 'Behind Baseline'
  );
end;
$$;

rollback;
