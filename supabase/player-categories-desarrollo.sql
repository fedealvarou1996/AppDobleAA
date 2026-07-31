-- Normaliza categorias disponibles:
-- - conserva Primera
-- - convierte cualquier otra categoria a Desarrollo
-- - evita que se vuelvan a guardar categorias fuera de Primera/Desarrollo

update public.players
set
  category = 'Desarrollo',
  updated_at = now()
where coalesce(btrim(category), '') <> 'Primera';

alter table public.players
drop constraint if exists players_category_allowed;

alter table public.players
add constraint players_category_allowed
check (category in ('Primera', 'Desarrollo'));
