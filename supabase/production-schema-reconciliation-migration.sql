-- Reconcile the deployed production baseline with the repository schema.
-- This migration intentionally does not change private.app_schema_state.

begin;

select pg_advisory_xact_lock(hashtext('travel_log_production_schema_reconciliation'));

do $$
declare
  stops_type text;
  existing_definition text;
begin
  if to_regclass('public.profiles') is null or to_regclass('public.trips') is null then
    raise exception 'Required Travel Log tables are missing';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'updated_at'
      and data_type <> 'timestamp with time zone'
  ) then
    raise exception 'public.profiles.updated_at has an unexpected type';
  end if;

  alter table public.profiles
    add column if not exists updated_at timestamptz;

  update public.profiles
  set updated_at = coalesce(created_at, now())
  where updated_at is null;

  alter table public.profiles
    alter column updated_at set default now(),
    alter column updated_at set not null;

  if exists (
    select 1
    from public.profiles
    where char_length(coalesce(full_name, '')) > 120
  ) then
    raise exception 'profiles.full_name contains values longer than 120 characters';
  end if;

  select pg_get_constraintdef(oid)
  into existing_definition
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and conname = 'profiles_full_name_check';

  if existing_definition is not null
     and existing_definition !~* 'char_length.*full_name.*<= 120' then
    raise exception 'profiles_full_name_check has an unexpected definition: %', existing_definition;
  end if;

  if existing_definition is null then
    alter table public.profiles
      add constraint profiles_full_name_check
      check (char_length(coalesce(full_name, '')) <= 120)
      not valid;
  end if;

  alter table public.profiles validate constraint profiles_full_name_check;

  select format_type(a.atttypid, a.atttypmod)
  into stops_type
  from pg_attribute a
  where a.attrelid = 'public.trips'::regclass
    and a.attname = 'stops'
    and not a.attisdropped;

  if stops_type = 'text[]' then
    if exists (
      select 1
      from public.trips
      where stops is null
         or array_ndims(stops) > 1
         or (cardinality(stops) > 0 and array_lower(stops, 1) <> 1)
         or cardinality(stops) > 8
         or exists (
           select 1
           from unnest(stops) as stop(value)
           where value is null
              or char_length(value) < 3
              or char_length(value) > 250
         )
    ) then
      raise exception 'trips.stops contains data that cannot be safely converted to the canonical JSON array';
    end if;

    alter table public.trips alter column stops drop default;
    alter table public.trips
      alter column stops type jsonb using to_jsonb(stops);
  elsif stops_type = 'jsonb' then
    if exists (
      select 1
      from public.trips
      where stops is null
         or jsonb_typeof(stops) <> 'array'
         or jsonb_array_length(stops) > 8
         or exists (
           select 1
           from jsonb_array_elements(stops) as stop(value)
           where jsonb_typeof(value) <> 'string'
              or char_length(value #>> '{}') < 3
              or char_length(value #>> '{}') > 250
         )
    ) then
      raise exception 'trips.stops violates the canonical JSON string-array contract';
    end if;
  else
    raise exception 'public.trips.stops has unexpected type %', coalesce(stops_type, '<missing>');
  end if;

  alter table public.trips
    alter column stops set default '[]'::jsonb,
    alter column stops set not null;

  select pg_get_constraintdef(oid)
  into existing_definition
  from pg_constraint
  where conrelid = 'public.trips'::regclass
    and conname = 'trips_stops_check';

  if existing_definition is not null
     and existing_definition !~* 'jsonb_typeof.*stops.*array' then
    raise exception 'trips_stops_check has an unexpected definition: %', existing_definition;
  end if;

  if existing_definition is null then
    alter table public.trips
      add constraint trips_stops_check
      check (jsonb_typeof(stops) = 'array')
      not valid;
  end if;

  alter table public.trips validate constraint trips_stops_check;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Users can view their profile' and cmd = 'SELECT'
      and roles @> array['authenticated']::name[]
      and qual ilike '%auth.uid()%id%'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Users can update their profile' and cmd = 'UPDATE'
      and roles @> array['authenticated']::name[]
      and qual ilike '%auth.uid()%id%'
      and with_check ilike '%auth.uid()%id%'
  ) then
    raise exception 'Canonical profile ownership policies are missing or unexpected';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trips'
      and policyname = 'Users can view their trips' and cmd = 'SELECT'
      and roles @> array['authenticated']::name[]
      and qual ilike '%auth.uid()%user_id%'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trips'
      and policyname = 'Users can add their trips' and cmd = 'INSERT'
      and roles @> array['authenticated']::name[]
      and with_check ilike '%auth.uid()%user_id%'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trips'
      and policyname = 'Users can update their trips' and cmd = 'UPDATE'
      and roles @> array['authenticated']::name[]
      and qual ilike '%auth.uid()%user_id%'
      and with_check ilike '%auth.uid()%user_id%'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trips'
      and policyname = 'Users can delete their trips' and cmd = 'DELETE'
      and roles @> array['authenticated']::name[]
      and qual ilike '%auth.uid()%user_id%'
  ) then
    raise exception 'Canonical trip ownership policies are missing or unexpected';
  end if;

  drop policy if exists "Users can view their own profile" on public.profiles;
  drop policy if exists "Users can update their own profile" on public.profiles;
  drop policy if exists "Users can view their own trips" on public.trips;
  drop policy if exists "Users can create their own trips" on public.trips;
  drop policy if exists "Users can update their own trips" on public.trips;
  drop policy if exists "Users can delete their own trips" on public.trips;

  if exists (
    select 1 from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'create_profile_after_signup'
      and not tgisinternal
  ) and not exists (
    select 1 from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'on_auth_user_created'
      and not tgisinternal
      and tgenabled <> 'D'
  ) then
    raise exception 'Cannot remove the legacy signup trigger without the canonical trigger';
  end if;

  drop trigger if exists create_profile_after_signup on auth.users;
  drop function if exists public.create_profile_for_new_user();

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'trips'
      and indexname = 'trips_user_date_idx'
      and indexdef ilike '%(user_id, trip_date desc)%'
  ) then
    raise exception 'Canonical trips_user_date_idx is missing or unexpected';
  end if;

  drop index if exists public.trips_trip_date_index;
  drop index if exists public.trips_user_id_index;
end
$$;

notify pgrst, 'reload schema';

commit;
