-- Add explicit user-recorded trip intent without inferring historical meaning.
-- Release order: apply to staging/production before deploying the schema-v4 browser.

begin;

select pg_advisory_xact_lock(hashtext('travel-log-trip-classification-v4'));

do $$
declare
  current_schema_version integer;
begin
  if to_regclass('public.trips') is null then
    raise exception 'public.trips is missing';
  end if;

  select schema_version into current_schema_version
  from private.app_schema_state
  where singleton = true;

  if current_schema_version not in (3, 4) then
    raise exception 'Expected application schema version 3 or 4, found %', coalesce(current_schema_version::text, '<missing>');
  end if;
end;
$$;

alter table public.trips
  add column if not exists classification text;

update public.trips
set classification = 'unclassified'
where classification is null;

do $$
begin
  if exists (
    select 1 from public.trips
    where classification not in ('work', 'personal', 'unclassified')
  ) then
    raise exception 'public.trips contains an unsupported classification value';
  end if;
end;
$$;

alter table public.trips
  alter column classification set default 'unclassified',
  alter column classification set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.trips'::regclass
      and conname = 'trips_classification_valid'
  ) then
    alter table public.trips
      add constraint trips_classification_valid
      check (classification in ('work', 'personal', 'unclassified'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.trips'::regclass
      and conname = 'trips_classification_valid'
      and pg_get_constraintdef(oid) = 'CHECK ((classification = ANY (ARRAY[''work''::text, ''personal''::text, ''unclassified''::text])))'
  ) then
    raise exception 'trips_classification_valid is missing or has an unexpected definition';
  end if;
end;
$$;

insert into private.app_schema_state (singleton, schema_version)
values (true, 4)
on conflict (singleton) do update
set schema_version = excluded.schema_version,
    updated_at = now();

notify pgrst, 'reload schema';

commit;
