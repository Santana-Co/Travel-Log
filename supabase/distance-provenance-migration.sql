-- Persist current distance provenance without inferring historical truth.
-- Release order: database first; deploy the schema-v5 browser only after verification.

begin;

select pg_advisory_xact_lock(hashtext('travel-log-distance-provenance-v5'));

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

  if current_schema_version not in (4, 5) then
    raise exception 'Expected application schema version 4 or 5, found %', coalesce(current_schema_version::text, '<missing>');
  end if;
end;
$$;

alter table public.trips
  add column if not exists distance_source text,
  add column if not exists manual_distance_reason text,
  add column if not exists manual_distance_note text;

-- Every pre-existing row remains unknown, even if other fields look suggestive.
update public.trips
set distance_source = 'unknown',
    manual_distance_reason = null,
    manual_distance_note = null
where distance_source is null;

do $$
begin
  if exists (
    select 1 from public.trips
    where distance_source not in ('route_calculated', 'manual', 'odometer', 'unknown')
       or (distance_source = 'manual' and manual_distance_reason is null)
       or (distance_source <> 'manual' and (manual_distance_reason is not null or manual_distance_note is not null))
       or manual_distance_reason not in ('route_unavailable', 'actual_route_differed', 'employer_provided', 'copied_from_trip', 'corrected_record', 'other')
       or char_length(coalesce(manual_distance_note, '')) > 300
  ) then
    raise exception 'public.trips contains invalid distance provenance';
  end if;
end;
$$;

alter table public.trips
  alter column distance_source set default 'unknown',
  alter column distance_source set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.trips'::regclass and conname = 'trips_distance_source_valid') then
    alter table public.trips add constraint trips_distance_source_valid check (distance_source in ('route_calculated', 'manual', 'odometer', 'unknown'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.trips'::regclass and conname = 'trips_manual_distance_reason_valid') then
    alter table public.trips add constraint trips_manual_distance_reason_valid check (manual_distance_reason is null or manual_distance_reason in ('route_unavailable', 'actual_route_differed', 'employer_provided', 'copied_from_trip', 'corrected_record', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.trips'::regclass and conname = 'trips_manual_distance_note_length') then
    alter table public.trips add constraint trips_manual_distance_note_length check (manual_distance_note is null or char_length(manual_distance_note) <= 300);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.trips'::regclass and conname = 'trips_manual_distance_evidence_consistent') then
    alter table public.trips add constraint trips_manual_distance_evidence_consistent check (
      (distance_source = 'manual' and manual_distance_reason is not null)
      or (distance_source <> 'manual' and manual_distance_reason is null and manual_distance_note is null)
    );
  end if;
end;
$$;

insert into private.app_schema_state (singleton, schema_version)
values (true, 5)
on conflict (singleton) do update
set schema_version = excluded.schema_version,
    updated_at = now();

notify pgrst, 'reload schema';

commit;
