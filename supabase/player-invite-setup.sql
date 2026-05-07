-- Policies recomendadas para el flujo de invitacion de jugadores.
-- Ajustalas si mas adelante permitis que el player edite su propia ficha.

alter table public.players enable row level security;

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
create policy "players_insert_admin_only"
on public.players
for insert
to authenticated
with check (
  exists (
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
