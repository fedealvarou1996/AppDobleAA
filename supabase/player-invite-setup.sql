-- Policies recomendadas para el flujo actual:
-- - admins pueden gestionar todos los jugadores
-- - players pueden registrar su propia ficha y ver solo la propia

alter table public.players enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.profiles as admin_profiles
    where admin_profiles.id = auth.uid()
      and admin_profiles.role = 'admin'
  )
);

drop policy if exists "profiles_insert_self_or_admin" on public.profiles;
create policy "profiles_insert_self_or_admin"
on public.profiles
for insert
to authenticated
with check (
  (id = auth.uid() and role = 'player')
  or exists (
    select 1
    from public.profiles as admin_profiles
    where admin_profiles.id = auth.uid()
      and admin_profiles.role = 'admin'
  )
);

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin"
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.profiles as admin_profiles
    where admin_profiles.id = auth.uid()
      and admin_profiles.role = 'admin'
  )
)
with check (
  (
    id = auth.uid()
    and role = 'player'
  )
  or exists (
    select 1
    from public.profiles as admin_profiles
    where admin_profiles.id = auth.uid()
      and admin_profiles.role = 'admin'
  )
);

drop policy if exists "players_select_own_or_admin" on public.players;
create policy "players_select_own_or_admin"
on public.players
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "players_insert_admin_only" on public.players;
create policy "players_insert_self_or_admin"
on public.players
for insert
to authenticated
with check (
  (
    user_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'player'
    )
  )
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "players_update_admin_only" on public.players;
create policy "players_update_admin_only"
on public.players
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "players_delete_admin_only" on public.players;
create policy "players_delete_admin_only"
on public.players
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);
