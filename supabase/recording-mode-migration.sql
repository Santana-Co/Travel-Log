-- Santana-Co Travel Log recording mode preference
-- Apply after appearance-theme-migration.sql and before deploying the matching frontend.

alter table public.profiles
  add column if not exists recording_mode text not null default 'general';

update public.profiles
set recording_mode = 'general'
where recording_mode not in ('general', 'ato_cents', 'ato_logbook');

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_recording_mode_valid') then
    alter table public.profiles
      add constraint profiles_recording_mode_valid
      check (recording_mode in ('general', 'ato_cents', 'ato_logbook'));
  end if;
end;
$$;

notify pgrst, 'reload schema';
