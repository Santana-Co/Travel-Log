-- Santana-Co Travel Log reporting and saved locations
-- Run once in the Supabase SQL Editor before deploying the matching frontend.

alter table public.trips
  add column if not exists purpose text,
  add column if not exists client_project text,
  add column if not exists vehicle text,
  add column if not exists rate_cents numeric(10,2) not null default 0;

create table if not exists public.saved_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  address text not null check (char_length(address) between 1 and 250),
  created_at timestamptz not null default now(),
  unique (user_id, label)
);

alter table public.saved_locations enable row level security;

drop policy if exists "Users can view their saved locations" on public.saved_locations;
create policy "Users can view their saved locations"
on public.saved_locations for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can add their saved locations" on public.saved_locations;
create policy "Users can add their saved locations"
on public.saved_locations for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their saved locations" on public.saved_locations;
create policy "Users can update their saved locations"
on public.saved_locations for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their saved locations" on public.saved_locations;
create policy "Users can delete their saved locations"
on public.saved_locations for delete
to authenticated
using ((select auth.uid()) = user_id);

