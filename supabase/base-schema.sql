-- Santana-Co Travel Log base database schema.
-- Run this first when creating a completely new Supabase environment.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text check (char_length(coalesce(full_name, '')) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_date date not null,
  start_address text not null,
  stops jsonb not null default '[]'::jsonb check (jsonb_typeof(stops) = 'array'),
  end_address text not null,
  distance_km numeric(12,1) not null,
  round_trip boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.trips enable row level security;

revoke all on table public.profiles, public.trips from anon;
grant select, insert, update, delete on table public.profiles, public.trips to authenticated;

drop policy if exists "Users can view their profile" on public.profiles;
create policy "Users can view their profile" on public.profiles
for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "Users can add their profile" on public.profiles;
create policy "Users can add their profile" on public.profiles
for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile" on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Users can view their trips" on public.trips;
create policy "Users can view their trips" on public.trips
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can add their trips" on public.trips;
create policy "Users can add their trips" on public.trips
for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their trips" on public.trips;
create policy "Users can update their trips" on public.trips
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their trips" on public.trips;
create policy "Users can delete their trips" on public.trips
for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
