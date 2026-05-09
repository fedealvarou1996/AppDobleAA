-- Agrega soporte de foto a la ficha tecnica de jugadores.
-- 1) columna photo_url en players
-- 2) bucket publico player-photos
-- 3) policies basicas para usuarios autenticados

alter table public.players
add column if not exists photo_url text;

alter table public.players
add column if not exists photo_thumb_url text;

insert into storage.buckets (id, name, public)
values ('player-photos', 'player-photos', true)
on conflict (id) do nothing;

update storage.buckets
set public = true
where id = 'player-photos';

drop policy if exists "player_photos_public_read" on storage.objects;
create policy "player_photos_public_read"
on storage.objects
for select
to public
using (bucket_id = 'player-photos');

drop policy if exists "player_photos_authenticated_upload" on storage.objects;
create policy "player_photos_authenticated_upload"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'player-photos');

drop policy if exists "player_photos_authenticated_update" on storage.objects;
create policy "player_photos_authenticated_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'player-photos')
with check (bucket_id = 'player-photos');

drop policy if exists "player_photos_authenticated_delete" on storage.objects;
create policy "player_photos_authenticated_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'player-photos');
