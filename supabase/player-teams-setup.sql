-- Soporte para asignar jugadores a uno o varios equipos
-- Ejecutar en Supabase SQL Editor

create table if not exists public.player_teams (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, team_id)
);

alter table public.player_teams enable row level security;

grant select, insert, update, delete on public.player_teams to authenticated;

create index if not exists idx_player_teams_player_id
  on public.player_teams(player_id);

create index if not exists idx_player_teams_team_id
  on public.player_teams(team_id);

insert into public.player_teams (player_id, team_id)
select id, team_id
from public.players
where team_id is not null
on conflict (player_id, team_id) do nothing;

drop policy if exists "player_teams_select_own_or_admin" on public.player_teams;
create policy "player_teams_select_own_or_admin"
on public.player_teams
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
  or exists (
    select 1
    from public.players
    where players.id = player_teams.player_id
      and players.user_id = auth.uid()
  )
);

drop policy if exists "player_teams_insert_admin_only" on public.player_teams;
create policy "player_teams_insert_admin_only"
on public.player_teams
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

drop policy if exists "player_teams_update_admin_only" on public.player_teams;
create policy "player_teams_update_admin_only"
on public.player_teams
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

drop policy if exists "player_teams_delete_admin_only" on public.player_teams;
create policy "player_teams_delete_admin_only"
on public.player_teams
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
