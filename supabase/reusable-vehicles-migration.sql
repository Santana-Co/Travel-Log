-- Schema 6: reusable convenience profiles, not a source of historical trip truth.
-- Apply and verify database first. No trip columns, backfill, references or rewrites.
begin;

select pg_advisory_xact_lock(hashtext('travel-log-reusable-vehicles-v6'));

do $$
declare current_schema_version integer;
begin
  select schema_version into current_schema_version
  from private.app_schema_state where singleton = true for update;
  if current_schema_version is null or current_schema_version not in (5, 6) then
    raise exception 'Expected application schema version 5 or 6';
  end if;
  if to_regclass('public.trips') is null then
    raise exception 'public.trips is missing';
  end if;
  if current_schema_version = 5 and to_regclass('public.vehicles') is not null then
    raise exception 'Unexpected vehicles table before schema 6; inspect drift before proceeding';
  end if;
end;
$$;

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null constraint vehicles_label_valid check (char_length(btrim(label)) between 1 and 120 and char_length(label) <= 120),
  registration text not null default '' constraint vehicles_registration_valid check (char_length(registration) <= 20),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vehicles_user_id_idx on public.vehicles (user_id);

alter table public.vehicles enable row level security;
-- Explicit grants: clients archive, never delete. Auth-account deletion cascades.
revoke all on table public.vehicles from public, anon, authenticated;
grant select on table public.vehicles to authenticated;
grant insert (id, user_id, label, registration, archived) on public.vehicles to authenticated;
grant update (label, registration, archived) on public.vehicles to authenticated;

drop policy if exists "Users can view their vehicles" on public.vehicles;
create policy "Users can view their vehicles" on public.vehicles
for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can add their vehicles" on public.vehicles;
create policy "Users can add their vehicles" on public.vehicles
for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their vehicles" on public.vehicles;
create policy "Users can update their vehicles" on public.vehicles
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.set_vehicle_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.set_vehicle_updated_at() from public, anon, authenticated;
drop trigger if exists vehicles_updated_at on public.vehicles;
create trigger vehicles_updated_at before update on public.vehicles
for each row execute function public.set_vehicle_updated_at();

insert into private.app_schema_state (singleton, schema_version)
values (true, 6)
on conflict (singleton) do update
set schema_version = excluded.schema_version, updated_at = now();
notify pgrst, 'reload schema';
commit;
