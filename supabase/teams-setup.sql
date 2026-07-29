-- Soporte para equipos administrables desde Supabase
-- Ejecutar en Supabase SQL Editor

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.teams enable row level security;

alter table public.players
  add column if not exists team_id uuid references public.teams(id) on delete set null;

create index if not exists idx_players_team_id
  on public.players(team_id);

grant select, insert, update, delete on public.teams to authenticated;

insert into public.teams (name, slug)
values
  ('Overtime', 'overtime'),
  ('BEA', 'bea')
on conflict (slug) do update
set name = excluded.name,
    updated_at = now();

drop policy if exists "teams_select_authenticated" on public.teams;
create policy "teams_select_authenticated"
on public.teams
for select
to authenticated
using (true);

drop policy if exists "teams_insert_admin_only" on public.teams;
create policy "teams_insert_admin_only"
on public.teams
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

drop policy if exists "teams_update_admin_only" on public.teams;
create policy "teams_update_admin_only"
on public.teams
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

drop policy if exists "teams_delete_admin_only" on public.teams;
create policy "teams_delete_admin_only"
on public.teams
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
