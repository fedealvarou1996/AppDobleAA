-- Agrega la columna user_id para vincular un jugador con un usuario de Supabase Auth.
-- user_id representa el usuario autenticado (auth.users.id) asociado a esa ficha de jugador.
-- Esto permite que un usuario con role = 'player' pueda ver solo su propia ficha.
-- Esta columna no reemplaza necesariamente a profile_id por ahora.
-- profile_id puede seguir usandose temporalmente como usuario/admin que creo el registro.

alter table public.players
add column if not exists user_id uuid references auth.users(id);

create index if not exists idx_players_user_id
on public.players(user_id);
