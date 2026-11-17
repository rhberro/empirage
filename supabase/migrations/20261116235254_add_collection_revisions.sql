alter table public.characters
  add column collection_revision bigint not null default 0 check (collection_revision >= 0);

create function public.advance_character_collection_revision(target_character_id uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare next_revision bigint;
begin
  update public.characters
  set collection_revision = collection_revision + 1
  where id = target_character_id
  returning collection_revision into next_revision;

  if next_revision is null then
    raise exception using errcode = '22023', message = 'character_not_found';
  end if;

  return next_revision;
end;
$$;

revoke all on function public.advance_character_collection_revision(uuid) from public, anon, authenticated;
grant execute on function public.advance_character_collection_revision(uuid) to service_role;
