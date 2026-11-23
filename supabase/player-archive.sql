-- Apply after schema.sql and rls.sql on new and existing databases.
begin;

alter table public.players add column if not exists archived_at timestamptz;

alter table public.matches
  drop constraint if exists matches_player1_id_fkey,
  drop constraint if exists matches_player2_id_fkey;

alter table public.matches
  add constraint matches_player1_id_fkey
    foreign key (player1_id) references public.players (id) on delete no action,
  add constraint matches_player2_id_fkey
    foreign key (player2_id) references public.players (id) on delete no action;

drop policy if exists "matches_insert_active_players" on public.matches;

create policy "matches_insert_active_players"
on public.matches as restrictive for insert
to authenticated
with check (
  exists (
    select 1 from public.players player
    where player.id = player1_id and player.archived_at is null
  )
  and exists (
    select 1 from public.players player
    where player.id = player2_id and player.archived_at is null
  )
);

commit;
