-- Verifica primero que no existan DNIs duplicados antes de agregar la constraint.
-- Ejemplo de chequeo:
-- select dni, count(*) from public.players group by dni having count(*) > 1;

alter table public.players
add constraint players_dni_unique unique (dni);
