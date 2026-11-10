create extension if not exists unaccent with schema extensions;

create or replace function public.normalize_character_name(value text)
returns text
language sql
immutable
parallel safe
as $$
  select lower(extensions.unaccent(value));
$$;

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slot smallint not null check (slot between 1 and 5),
  name text not null,
  gender text not null default 'male' check (gender in ('male', 'female')),
  level smallint not null default 1 check (level >= 1),
  avatar_url text,
  name_normalized text generated always as (public.normalize_character_name(name)) stored,
  created_at timestamptz not null default now(),
  constraint characters_name_length check (char_length(name) between 3 and 15),
  constraint characters_name_format check (
    name = btrim(name)
    and name !~ '  '
    and name ~ '^[[:alpha:] ''_-]+$'
  ),
  constraint characters_user_slot_key unique (user_id, slot)
);

create unique index characters_name_normalized_key on public.characters (name_normalized);

alter table public.characters enable row level security;

revoke all on table public.characters from anon, authenticated;

grant select, delete on table public.characters to authenticated;

create policy "Users can view their own characters"
on public.characters
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can delete their own characters"
on public.characters
for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.create_character(
  character_name text,
  character_gender text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  available_slot smallint;
  created_character_id uuid;
  violated_constraint text;
begin
  if current_user_id is null then
    raise exception using
      errcode = 'P0003',
      message = 'authentication_required';
  end if;

  if character_gender not in ('male', 'female') or character_gender is null then
    raise exception using
      errcode = '22023',
      message = 'invalid_character_gender';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(current_user_id::text, 0));

  select candidate.slot
  into available_slot
  from pg_catalog.generate_series(1, 5) as candidate(slot)
  where not exists (
    select 1
    from public.characters
    where characters.user_id = current_user_id
      and characters.slot = candidate.slot
  )
  order by candidate.slot
  limit 1;

  if available_slot is null then
    raise exception using
      errcode = 'P0002',
      message = 'character_limit_reached';
  end if;

  begin
    insert into public.characters (user_id, slot, name, gender)
    values (current_user_id, available_slot, character_name, character_gender)
    returning id into created_character_id;
  exception
    when unique_violation then
      get stacked diagnostics violated_constraint = constraint_name;

      if violated_constraint = 'characters_name_normalized_key' then
        raise exception using
          errcode = 'P0001',
          message = 'character_name_unavailable';
      end if;

      raise;
  end;

  return created_character_id;
end;
$$;

revoke execute on function public.create_character(text, text) from public;

revoke execute on function public.create_character(text, text) from anon;

revoke execute on function public.create_character(text, text) from authenticated;

grant execute on function public.create_character(text, text) to authenticated;
