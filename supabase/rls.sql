-- Tennis Score Stats Row Level Security policies.
-- Run this after supabase/schema.sql.

alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.service_events enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.players from anon, authenticated;
revoke all on table public.matches from anon, authenticated;
revoke all on table public.service_events from anon, authenticated;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.players to authenticated;
grant select, insert, update, delete on table public.matches to authenticated;
grant select, insert, update, delete on table public.service_events to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "profiles_delete_own"
on public.profiles for delete
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "players_select_own" on public.players;
drop policy if exists "players_insert_own" on public.players;
drop policy if exists "players_update_own" on public.players;
drop policy if exists "players_delete_own" on public.players;

create policy "players_select_own"
on public.players for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "players_insert_own"
on public.players for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "players_update_own"
on public.players for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "players_delete_own"
on public.players for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "matches_select_own" on public.matches;
drop policy if exists "matches_insert_own" on public.matches;
drop policy if exists "matches_update_own" on public.matches;
drop policy if exists "matches_delete_own" on public.matches;

create policy "matches_select_own"
on public.matches for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "matches_insert_own"
on public.matches for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.players p1
    where p1.id = player1_id
      and p1.user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.players p2
    where p2.id = player2_id
      and p2.user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.players server
    where server.id = initial_server_id
      and server.user_id = (select auth.uid())
  )
);

create policy "matches_update_own"
on public.matches for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.players p1
    where p1.id = player1_id
      and p1.user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.players p2
    where p2.id = player2_id
      and p2.user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.players server
    where server.id = initial_server_id
      and server.user_id = (select auth.uid())
  )
);

create policy "matches_delete_own"
on public.matches for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "service_events_select_own" on public.service_events;
drop policy if exists "service_events_insert_own" on public.service_events;
drop policy if exists "service_events_update_own" on public.service_events;
drop policy if exists "service_events_delete_own" on public.service_events;

create policy "service_events_select_own"
on public.service_events for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "service_events_insert_own"
on public.service_events for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.matches m
    where m.id = match_id
      and m.user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.players server
    where server.id = server_id
      and server.user_id = (select auth.uid())
  )
  and (
    point_winner_id is null
    or exists (
      select 1
      from public.players winner
      where winner.id = point_winner_id
        and winner.user_id = (select auth.uid())
    )
  )
);

create policy "service_events_update_own"
on public.service_events for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.matches m
    where m.id = match_id
      and m.user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.players server
    where server.id = server_id
      and server.user_id = (select auth.uid())
  )
  and (
    point_winner_id is null
    or exists (
      select 1
      from public.players winner
      where winner.id = point_winner_id
        and winner.user_id = (select auth.uid())
    )
  )
);

create policy "service_events_delete_own"
on public.service_events for delete
to authenticated
using ((select auth.uid()) = user_id);
