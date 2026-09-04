-- Fix account deletion's recent-authentication timestamp comparison.
-- Apply after account-reauthentication-migration.sql.

create or replace function public.delete_my_account()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  issued_at bigint := nullif((select auth.jwt()) ->> 'iat', '')::bigint;
  current_epoch bigint := extract(epoch from now())::bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if issued_at is null or current_epoch - issued_at > 300 then
    raise exception 'Recent authentication required';
  end if;

  perform private.delete_my_account_internal();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

notify pgrst, 'reload schema';
