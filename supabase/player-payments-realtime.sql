-- Notificaciones en vivo para pagos de jugadores
-- Ejecutar en Supabase SQL Editor si queres que el dashboard admin se actualice sin recargar.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'player_payments'
  ) then
    alter publication supabase_realtime add table public.player_payments;
  end if;
end $$;
