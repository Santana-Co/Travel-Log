-- Santana-Co Travel Log database compatibility contract.
-- Apply this migration before deploying an app release that requires schema version 3.

create schema if not exists private;

create table if not exists private.app_schema_state (
  singleton boolean primary key default true check (singleton),
  schema_version integer not null check (schema_version > 0),
  updated_at timestamptz not null default now()
);

revoke all on table private.app_schema_state from public, anon, authenticated;

insert into private.app_schema_state (singleton, schema_version)
values (true, 3)
on conflict (singleton) do update
set schema_version = greatest(private.app_schema_state.schema_version, excluded.schema_version),
    updated_at = now();

create or replace function public.get_app_schema_version()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select schema_version
  from private.app_schema_state
  where singleton = true
$$;

revoke all on function public.get_app_schema_version() from public, anon;
grant execute on function public.get_app_schema_version() to authenticated;

notify pgrst, 'reload schema';
