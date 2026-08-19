-- Santana-Co Travel Log privacy controls
-- Run once in the Supabase SQL Editor before deploying the matching frontend.

alter table public.profiles
  add column if not exists privacy_version text,
  add column if not exists privacy_accepted_at timestamptz;

create or replace function public.accept_privacy_notice(notice_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if notice_version is null or length(notice_version) < 1 or length(notice_version) > 50 then
    raise exception 'Invalid privacy notice version';
  end if;

  update public.profiles
  set privacy_version = notice_version,
      privacy_accepted_at = now()
  where id = (select auth.uid());

  if not found then
    raise exception 'Profile not found';
  end if;
end;
$$;

revoke all on function public.accept_privacy_notice(text) from public, anon;
grant execute on function public.accept_privacy_notice(text) to authenticated;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requesting_user uuid := (select auth.uid());
begin
  if requesting_user is null then
    raise exception 'Authentication required';
  end if;

  delete from public.trips where user_id = requesting_user;
  delete from public.profiles where id = requesting_user;
  delete from auth.users where id = requesting_user;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

