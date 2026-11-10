alter table public.characters
add column is_selected boolean not null default false;

create unique index characters_one_selected_per_user_idx
on public.characters (user_id)
where is_selected;

create or replace function public.select_character(character_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception using
      errcode = 'P0003',
      message = 'authentication_required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 0)
  );

  if not exists (
    select 1
    from public.characters
    where id = character_id
      and user_id = current_user_id
  ) then
    raise exception using
      errcode = 'P0004',
      message = 'character_not_found';
  end if;

  update public.characters
  set is_selected = false
  where user_id = current_user_id
    and is_selected;

  update public.characters
  set is_selected = true
  where id = character_id
    and user_id = current_user_id;
end;
$$;

revoke execute on function public.select_character(uuid) from public;
revoke execute on function public.select_character(uuid) from anon;
revoke execute on function public.select_character(uuid) from authenticated;
grant execute on function public.select_character(uuid) to authenticated;
