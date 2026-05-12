-- Historial de pagos por jugador
-- Ejecutar en Supabase SQL Editor

create table if not exists public.player_payments (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  payment_date date not null default current_date,
  method text,
  period text,
  status text not null default 'paid',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_player_payments_player_id
  on public.player_payments(player_id);

create index if not exists idx_player_payments_payment_date
  on public.player_payments(payment_date desc);

alter table public.player_payments enable row level security;

drop policy if exists "player_payments_select_own_or_admin" on public.player_payments;
create policy "player_payments_select_own_or_admin"
on public.player_payments
for select
to authenticated
using (
  exists (
    select 1
    from public.players
    where players.id = player_payments.player_id
      and players.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "player_payments_insert_admin_only" on public.player_payments;
create policy "player_payments_insert_admin_only"
on public.player_payments
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

drop policy if exists "player_payments_update_admin_only" on public.player_payments;
create policy "player_payments_update_admin_only"
on public.player_payments
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

drop policy if exists "player_payments_delete_admin_only" on public.player_payments;
create policy "player_payments_delete_admin_only"
on public.player_payments
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
