-- Verificacion publica de carnet por ID de jugador.
-- Devuelve solo campos minimos para mostrar una ficha tecnica publica.

drop function if exists public.get_public_player_card(uuid);

create function public.get_public_player_card(p_player_id uuid)
returns table (
  id uuid,
  first_name text,
  last_name text,
  photo_url text,
  payment_status boolean,
  created_at timestamptz,
  last_payment_date date,
  teams text
)
language sql
security definer
set search_path = public
as $$
  select
    players.id,
    players.first_name,
    players.last_name,
    players.photo_url,
    players.payment_status,
    players.created_at,
    players.last_payment_date,
    coalesce(
      string_agg(teams.name, ', ' order by teams.name) filter (where teams.name is not null),
      ''
    ) as teams
  from public.players
  left join public.player_teams
    on player_teams.player_id = players.id
  left join public.teams
    on teams.id = player_teams.team_id
    and coalesce(teams.is_active, true) = true
  where players.id = p_player_id
    and coalesce(players.is_active, true) = true
  group by
    players.id,
    players.first_name,
    players.last_name,
    players.photo_url,
    players.payment_status,
    players.created_at,
    players.last_payment_date
  limit 1;
$$;

revoke all on function public.get_public_player_card(uuid) from public;
grant execute on function public.get_public_player_card(uuid) to anon;
grant execute on function public.get_public_player_card(uuid) to authenticated;
