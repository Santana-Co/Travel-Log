-- Santana-Co Travel Log stabilization safeguards
-- Apply after reporting-migration.sql.

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.saved_locations enable row level security;

revoke all on table public.profiles, public.trips, public.saved_locations from anon;
grant select, insert, update, delete on table public.profiles, public.trips, public.saved_locations to authenticated;

create index if not exists trips_user_date_idx on public.trips (user_id, trip_date desc);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'trips_distance_reasonable') then
    alter table public.trips add constraint trips_distance_reasonable check (distance_km > 0 and distance_km <= 100000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trips_rate_reasonable') then
    alter table public.trips add constraint trips_rate_reasonable check (rate_cents >= 0 and rate_cents <= 1000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trips_address_lengths') then
    alter table public.trips add constraint trips_address_lengths check (char_length(start_address) between 3 and 250 and char_length(end_address) between 3 and 250) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trips_reporting_lengths') then
    alter table public.trips add constraint trips_reporting_lengths check (char_length(coalesce(purpose, '')) <= 80 and char_length(coalesce(client_project, '')) <= 120 and char_length(coalesce(vehicle, '')) <= 120 and char_length(coalesce(notes, '')) <= 2000) not valid;
  end if;
end;
$$;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.accept_privacy_notice_internal(notice_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if notice_version is null or length(notice_version) < 1 or length(notice_version) > 50 then raise exception 'Invalid privacy notice version'; end if;
  update public.profiles set privacy_version = notice_version, privacy_accepted_at = now() where id = (select auth.uid());
  if not found then raise exception 'Profile not found'; end if;
end;
$$;

create or replace function private.delete_my_account_internal()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user uuid := (select auth.uid());
begin
  if requesting_user is null then raise exception 'Authentication required'; end if;
  delete from public.saved_locations where user_id = requesting_user;
  delete from public.trips where user_id = requesting_user;
  delete from public.profiles where id = requesting_user;
  delete from auth.users where id = requesting_user;
end;
$$;

revoke all on function private.accept_privacy_notice_internal(text), private.delete_my_account_internal() from public, anon;
grant execute on function private.accept_privacy_notice_internal(text), private.delete_my_account_internal() to authenticated;

create or replace function public.accept_privacy_notice(notice_version text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$ begin perform private.accept_privacy_notice_internal(notice_version); end; $$;

create or replace function public.delete_my_account()
returns void
language plpgsql
security invoker
set search_path = ''
as $$ begin perform private.delete_my_account_internal(); end; $$;

revoke all on function public.accept_privacy_notice(text), public.delete_my_account() from public, anon;
grant execute on function public.accept_privacy_notice(text), public.delete_my_account() to authenticated;

