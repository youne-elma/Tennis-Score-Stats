-- Tennis Score Stats user roles.
-- Run this after supabase/schema.sql, supabase/rls.sql, and supabase/auth-trigger.sql.
--
-- This creates a dedicated roles table instead of storing roles directly in
-- profiles, so users can still edit their profile without being able to promote
-- themselves to coach or admin.

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_roles_role_check check (role in ('user', 'coach', 'admin'))
);

create index if not exists user_roles_role_idx on public.user_roles (role);

alter table public.user_roles enable row level security;

revoke all on table public.user_roles from anon, authenticated;
grant select, insert, update, delete on table public.user_roles to authenticated;

create schema if not exists private;

create or replace function private.current_user_role()
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(
    (
      select role
      from public.user_roles
      where user_id = (select auth.uid())
    ),
    'user'
  );
$$;

revoke execute on function private.current_user_role() from public;
grant usage on schema private to authenticated;
grant execute on function private.current_user_role() to authenticated;

create or replace function public.handle_user_role_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_roles_set_updated_at on public.user_roles;

create trigger user_roles_set_updated_at
before update on public.user_roles
for each row
execute function public.handle_user_role_updated_at();

drop policy if exists "user_roles_select_visible" on public.user_roles;
drop policy if exists "user_roles_insert_admin" on public.user_roles;
drop policy if exists "user_roles_update_admin" on public.user_roles;
drop policy if exists "user_roles_delete_admin" on public.user_roles;

create policy "user_roles_select_visible"
on public.user_roles for select
to authenticated
using (
  (select auth.uid()) = user_id
  or (select private.current_user_role()) in ('coach', 'admin')
);

create policy "user_roles_insert_admin"
on public.user_roles for insert
to authenticated
with check ((select private.current_user_role()) = 'admin');

create policy "user_roles_update_admin"
on public.user_roles for update
to authenticated
using ((select private.current_user_role()) = 'admin')
with check ((select private.current_user_role()) = 'admin');

create policy "user_roles_delete_admin"
on public.user_roles for delete
to authenticated
using ((select private.current_user_role()) = 'admin');

insert into public.user_roles (user_id, role)
select id, 'user'
from auth.users
on conflict (user_id) do nothing;

create or replace function private.handle_new_user_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_role_created on auth.users;

create trigger on_auth_user_role_created
after insert on auth.users
for each row
execute function private.handle_new_user_role();

-- Optional: promote your own account after running this file.
-- Replace the email below, remove the comment markers, then run only this block.
--
-- insert into public.user_roles (user_id, role)
-- select id, 'admin'
-- from auth.users
-- where email = 'your-email@example.com'
-- on conflict (user_id) do update
-- set role = excluded.role;
