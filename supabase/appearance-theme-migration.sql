-- Santana-Co Travel Log appearance preference
-- Apply after ato-logbook-migration.sql and before deploying the matching frontend.

alter table public.profiles
  add column if not exists appearance_theme text not null default 'system';

update public.profiles
set appearance_theme = 'system'
where appearance_theme not in ('light', 'dark', 'system');

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_appearance_theme_valid') then
    alter table public.profiles
      add constraint profiles_appearance_theme_valid
      check (appearance_theme in ('light', 'dark', 'system'));
  end if;
end;
$$;
