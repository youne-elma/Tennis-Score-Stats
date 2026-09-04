-- Tennis Score Stats database schema.
-- Task B only: tables, constraints, foreign keys, and indexes.
-- RLS policies are intentionally kept for the next task.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  gender text not null,
  handedness text not null,
  birthday_date date not null,
  strengths text,
  weaknesses text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint players_gender_check check (gender in ('Female', 'Male', 'Other')),
  constraint players_handedness_check check (handedness in ('Right-handed', 'Left-handed', 'Ambidextrous')),
  constraint players_birthday_not_future_check check (birthday_date <= current_date)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  player1_id uuid not null references public.players (id) on delete cascade,
  player2_id uuid not null references public.players (id) on delete cascade,
  initial_server_id uuid not null references public.players (id) on delete restrict,
  number_of_sets text not null,
  games_per_set text not null,
  use_tiebreaks boolean not null default true,
  tiebreak_type text not null,
  deuce_scoring text not null,
  court_view text not null,
  status text not null default 'Not started',
  pause_reason text,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_different_players_check check (player1_id <> player2_id),
  constraint matches_initial_server_check check (initial_server_id in (player1_id, player2_id)),
  constraint matches_number_of_sets_check check (number_of_sets in ('1', '2', '3', '5')),
  constraint matches_games_per_set_check check (games_per_set in ('4', '5', '6')),
  constraint matches_tiebreak_type_check check (
    tiebreak_type in ('Standard 7 points', 'Super Tiebreak 10 points', 'Match Tiebreak')
  ),
  constraint matches_deuce_scoring_check check (deuce_scoring in ('Advantage (Long Deuce)', 'No-Ad (Short Deuce)')),
  constraint matches_court_view_check check (court_view in ('Behind Baseline', 'Side View')),
  constraint matches_status_check check (status in ('Not started', 'In progress', 'Paused', 'Ended'))
);

create table if not exists public.service_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  server_id uuid not null references public.players (id) on delete restrict,
  phase text not null,
  action text not null,
  serve_type text,
  zone text,
  fault_type text,
  point_winner_id uuid references public.players (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_events_phase_check check (phase in ('First Serve', 'Second Serve')),
  constraint service_events_action_check check (action in ('Fault', 'Ace', 'Service Winner', 'In Play')),
  constraint service_events_serve_type_check check (serve_type is null or serve_type in ('Flat', 'Kick', 'Slice')),
  constraint service_events_zone_check check (
    zone is null or zone in ('Down the line', 'To the body', 'Wide', 'T (center)', 'In the corner')
  ),
  constraint service_events_fault_type_check check (
    fault_type is null or fault_type in ('In the net', 'Too Long', 'Too Wide', 'Outside the T')
  ),
  constraint service_events_fault_type_required_check check (
    (action = 'Fault' and fault_type is not null) or (action <> 'Fault' and fault_type is null)
  ),
  constraint service_events_point_winner_check check (
    (action = 'In Play' and point_winner_id is not null) or (action <> 'In Play' and point_winner_id is null)
  ),
  constraint service_events_serve_detail_check check (
    (action in ('Fault', 'Ace', 'Service Winner') and serve_type is not null and zone is not null)
    or (action = 'In Play' and serve_type is null and zone is null)
  )
);

create index if not exists players_user_id_idx on public.players (user_id);
create index if not exists matches_user_id_idx on public.matches (user_id);
create index if not exists matches_player1_id_idx on public.matches (player1_id);
create index if not exists matches_player2_id_idx on public.matches (player2_id);
create index if not exists service_events_user_id_idx on public.service_events (user_id);
create index if not exists service_events_match_id_idx on public.service_events (match_id);
create index if not exists service_events_server_id_idx on public.service_events (server_id);
