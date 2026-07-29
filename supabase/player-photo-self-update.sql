-- Permite que un jugador autenticado actualice solo la foto de su propia ficha.
-- No habilita edicion general de players para usuarios player.

create or replace function public.update_own_player_photo(
  p_player_id uuid,
  p_photo_url text,
  p_photo_thumb_url text
)
returns table (
  id uuid,
  photo_url text,
  photo_thumb_url text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuario no autenticado.';
  end if;

  return query
  update public.players
  set
    photo_url = p_photo_url,
    photo_thumb_url = p_photo_thumb_url,
    updated_at = now()
  where players.id = p_player_id
    and (
      players.user_id = auth.uid()
      or players.profile_id = auth.uid()
    )
    and coalesce(players.is_active, true) = true
  returning
    players.id,
    players.photo_url,
    players.photo_thumb_url,
    players.updated_at;

  if not found then
    raise exception 'No se encontro una ficha propia activa para actualizar.';
  end if;
end;
$$;

revoke all on function public.update_own_player_photo(uuid, text, text) from public;
grant execute on function public.update_own_player_photo(uuid, text, text) to authenticated;
