-- Soporte para Checkout Pro de Mercado Pago
-- Ejecutar en Supabase SQL Editor

alter table public.player_payments
  add column if not exists mp_payment_id text,
  add column if not exists mp_preference_id text;

create unique index if not exists idx_player_payments_mp_payment_id
  on public.player_payments(mp_payment_id)
  where mp_payment_id is not null;

create table if not exists public.mercadopago_events (
  id uuid primary key default gen_random_uuid(),
  event_type text,
  action text,
  external_reference text,
  mp_payment_id text,
  mp_preference_id text,
  status text,
  status_detail text,
  amount numeric(12,2),
  player_id uuid references public.players(id) on delete set null,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mercadopago_events_player_id
  on public.mercadopago_events(player_id);

create index if not exists idx_mercadopago_events_mp_payment_id
  on public.mercadopago_events(mp_payment_id);

create index if not exists idx_mercadopago_events_created_at
  on public.mercadopago_events(created_at desc);

alter table public.mercadopago_events enable row level security;

revoke all on public.mercadopago_events from anon;
revoke all on public.mercadopago_events from authenticated;
grant select on public.mercadopago_events to authenticated;

drop policy if exists "mercadopago_events_select_admin_only" on public.mercadopago_events;
create policy "mercadopago_events_select_admin_only"
on public.mercadopago_events
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);
