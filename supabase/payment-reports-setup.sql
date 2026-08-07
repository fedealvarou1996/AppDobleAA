-- Pagos informados por jugadores con comprobante
-- Ejecutar en Supabase SQL Editor.

alter table public.player_payments
  add column if not exists receipt_path text,
  add column if not exists receipt_file_name text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id);

create index if not exists idx_player_payments_status_created_at
  on public.player_payments(status, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-receipts',
  'payment-receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "payment_receipts_insert_own" on storage.objects;
create policy "payment_receipts_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'payment-receipts'
  and exists (
    select 1
    from public.players
    where players.id::text = (storage.foldername(name))[1]
      and (players.user_id = auth.uid() or players.profile_id = auth.uid())
  )
);

drop policy if exists "payment_receipts_select_own_or_admin" on storage.objects;
create policy "payment_receipts_select_own_or_admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-receipts'
  and (
    exists (
      select 1
      from public.players
      where players.id::text = (storage.foldername(name))[1]
        and (players.user_id = auth.uid() or players.profile_id = auth.uid())
    )
    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  )
);

drop policy if exists "payment_receipts_delete_admin_only" on storage.objects;
create policy "payment_receipts_delete_admin_only"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'payment-receipts'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "player_payments_insert_own_reported" on public.player_payments;
create policy "player_payments_insert_own_reported"
on public.player_payments
for insert
to authenticated
with check (
  status = 'reported'
  and exists (
    select 1
    from public.players
    where players.id = player_payments.player_id
      and (players.user_id = auth.uid() or players.profile_id = auth.uid())
  )
);
