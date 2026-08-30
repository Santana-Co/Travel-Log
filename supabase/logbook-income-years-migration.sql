-- Santana-Co Travel Log annual odometer records for the ATO logbook method.
-- Apply after ato-logbook-migration.sql and before appearance-theme-migration.sql.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'logbook_periods_id_user_unique') then
    alter table public.logbook_periods
      add constraint logbook_periods_id_user_unique unique (id, user_id);
  end if;
end;
$$;

create table if not exists public.logbook_income_years (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logbook_period_id uuid not null,
  vehicle_registration text not null check (char_length(vehicle_registration) between 1 and 20),
  income_year_start integer not null check (income_year_start between 2000 and 2100),
  opening_odometer numeric(12,1) not null check (opening_odometer >= 0),
  closing_odometer numeric(12,1) not null,
  circumstances_changed boolean not null default false,
  notes text check (char_length(coalesce(notes, '')) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, vehicle_registration, income_year_start),
  foreign key (logbook_period_id, user_id)
    references public.logbook_periods(id, user_id) on delete cascade,
  check (closing_odometer > opening_odometer)
);

alter table public.logbook_income_years enable row level security;
revoke all on table public.logbook_income_years from anon;
grant select, insert, update, delete on table public.logbook_income_years to authenticated;

drop policy if exists "Users can view their annual odometer records" on public.logbook_income_years;
create policy "Users can view their annual odometer records" on public.logbook_income_years
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can add their annual odometer records" on public.logbook_income_years;
create policy "Users can add their annual odometer records" on public.logbook_income_years
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their annual odometer records" on public.logbook_income_years;
create policy "Users can update their annual odometer records" on public.logbook_income_years
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete their annual odometer records" on public.logbook_income_years;
create policy "Users can delete their annual odometer records" on public.logbook_income_years
  for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists logbook_income_years_user_vehicle_year_idx
  on public.logbook_income_years (user_id, vehicle_registration, income_year_start desc);

-- Preserve annual readings entered through the original combined logbook form.
insert into public.logbook_income_years (
  user_id, logbook_period_id, vehicle_registration, income_year_start,
  opening_odometer, closing_odometer
)
select
  user_id,
  id,
  vehicle_registration,
  case when extract(month from start_date) >= 7
    then extract(year from start_date)::integer
    else extract(year from start_date)::integer - 1
  end,
  income_year_opening_odometer,
  income_year_closing_odometer
from public.logbook_periods
where income_year_opening_odometer is not null
  and income_year_closing_odometer is not null
  and income_year_closing_odometer > income_year_opening_odometer
on conflict (user_id, vehicle_registration, income_year_start) do update
set logbook_period_id = excluded.logbook_period_id,
    opening_odometer = excluded.opening_odometer,
    closing_odometer = excluded.closing_odometer,
    updated_at = now();

create or replace function private.delete_my_account_internal()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare requesting_user uuid := (select auth.uid());
begin
  if requesting_user is null then raise exception 'Authentication required'; end if;
  delete from public.logbook_income_years where user_id = requesting_user;
  delete from public.logbook_periods where user_id = requesting_user;
  delete from public.saved_locations where user_id = requesting_user;
  delete from public.trips where user_id = requesting_user;
  delete from public.profiles where id = requesting_user;
  delete from auth.users where id = requesting_user;
end;
$$;

revoke all on function private.delete_my_account_internal() from public, anon;
grant execute on function private.delete_my_account_internal() to authenticated;

notify pgrst, 'reload schema';
