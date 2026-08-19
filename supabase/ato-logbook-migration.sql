-- Santana-Co Travel Log ATO vehicle and odometer records
-- Apply after stabilization-migration.sql and before deploying the matching frontend.

alter table public.trips
  add column if not exists trip_end_date date,
  add column if not exists vehicle_registration text,
  add column if not exists odometer_start numeric(12,1),
  add column if not exists odometer_end numeric(12,1),
  add column if not exists claim_method text not null default 'record_only';

update public.trips set trip_end_date = trip_date where trip_end_date is null;
alter table public.trips alter column trip_end_date set not null;

update public.trips
set claim_method = case when coalesce(rate_cents, 0) > 0 then 'employer' else 'record_only' end
where claim_method = 'record_only';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'trips_claim_method_valid') then
    alter table public.trips add constraint trips_claim_method_valid check (claim_method in ('record_only', 'employer', 'ato_cents', 'ato_logbook'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trips_date_range_valid') then
    alter table public.trips add constraint trips_date_range_valid check (trip_end_date >= trip_date);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trips_registration_length') then
    alter table public.trips add constraint trips_registration_length check (char_length(coalesce(vehicle_registration, '')) <= 20);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trips_odometer_pair_valid') then
    alter table public.trips add constraint trips_odometer_pair_valid check (
      (odometer_start is null and odometer_end is null)
      or (odometer_start >= 0 and odometer_end > odometer_start)
    );
  end if;
end;
$$;

create table if not exists public.logbook_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_registration text not null check (char_length(vehicle_registration) between 1 and 20),
  vehicle_description text not null check (char_length(vehicle_description) between 1 and 120),
  engine_capacity text check (char_length(coalesce(engine_capacity, '')) <= 40),
  start_date date not null,
  end_date date not null,
  opening_odometer numeric(12,1) not null check (opening_odometer >= 0),
  closing_odometer numeric(12,1) not null,
  income_year_opening_odometer numeric(12,1),
  income_year_closing_odometer numeric(12,1),
  created_at timestamptz not null default now(),
  unique (user_id, vehicle_registration, start_date),
  check (end_date >= start_date + 83),
  check (closing_odometer > opening_odometer),
  check (income_year_opening_odometer is null or income_year_opening_odometer >= 0),
  check (income_year_closing_odometer is null or income_year_closing_odometer >= income_year_opening_odometer)
);

alter table public.logbook_periods enable row level security;
revoke all on table public.logbook_periods from anon;
grant select, insert, update, delete on table public.logbook_periods to authenticated;

drop policy if exists "Users can view their logbook periods" on public.logbook_periods;
create policy "Users can view their logbook periods" on public.logbook_periods for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can add their logbook periods" on public.logbook_periods;
create policy "Users can add their logbook periods" on public.logbook_periods for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their logbook periods" on public.logbook_periods;
create policy "Users can update their logbook periods" on public.logbook_periods for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete their logbook periods" on public.logbook_periods;
create policy "Users can delete their logbook periods" on public.logbook_periods for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists logbook_periods_user_vehicle_idx on public.logbook_periods (user_id, vehicle_registration, start_date desc);

create or replace function private.delete_my_account_internal()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare requesting_user uuid := (select auth.uid());
begin
  if requesting_user is null then raise exception 'Authentication required'; end if;
  delete from public.logbook_periods where user_id = requesting_user;
  delete from public.saved_locations where user_id = requesting_user;
  delete from public.trips where user_id = requesting_user;
  delete from public.profiles where id = requesting_user;
  delete from auth.users where id = requesting_user;
end;
$$;

revoke all on function private.delete_my_account_internal() from public, anon;
grant execute on function private.delete_my_account_internal() to authenticated;
