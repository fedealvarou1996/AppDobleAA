-- Agrega el campo camiseta a la ficha del jugador.
-- Tambien permite que un jugador autenticado edite solo su propia camiseta.

alter table public.players
add column if not exists jersey_number text;

create or replace function public.update_own_player_jersey(
  p_player_id uuid,
  p_jersey_number text
)
returns table (
  id uuid,
  jersey_number text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jersey_number text := nullif(btrim(p_jersey_number), '');
begin
  if auth.uid() is null then
    raise exception 'Usuario no autenticado.';
  end if;

  if v_jersey_number is not null and exists (
    select 1
    from public.players
    where lower(btrim(players.jersey_number)) = lower(v_jersey_number)
      and players.id <> p_player_id
      and coalesce(players.is_active, true) = true
  ) then
    raise exception 'Ya existe otro jugador activo con esa camiseta.';
  end if;

  return query
  update public.players
  set
    jersey_number = v_jersey_number,
    updated_at = now()
  where players.id = p_player_id
    and (
      players.user_id = auth.uid()
      or players.profile_id = auth.uid()
    )
    and coalesce(players.is_active, true) = true
  returning
    players.id,
    players.jersey_number,
    players.updated_at;

  if not found then
    raise exception 'No se encontro una ficha propia activa para actualizar.';
  end if;
end;
$$;

revoke all on function public.update_own_player_jersey(uuid, text) from public;
grant execute on function public.update_own_player_jersey(uuid, text) to authenticated;
