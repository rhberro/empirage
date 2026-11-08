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
  name_normalized text not null,
  created_at timestamptz not null default now(),
  constraint characters_name_length check (char_length(name) between 3 and 15),
  constraint characters_name_format check (
    name = btrim(name)
    and name !~ '  '
    and name ~ '^[[:alpha:][:digit:] _-]+$'
  ),
  constraint characters_user_slot_key unique (user_id, slot),
  constraint characters_name_key unique (name)
);

create index characters_user_id_idx on public.characters (user_id);
create unique index characters_name_normalized_key on public.characters (name_normalized);

create or replace function public.set_character_name_normalized()
returns trigger
language plpgsql
as $$
begin
  new.name_normalized := public.normalize_character_name(new.name);
  return new;
end;
$$;

create trigger set_character_name_normalized
before insert or update of name on public.characters
for each row
execute function public.set_character_name_normalized();

alter table public.characters enable row level security;

revoke all on table public.characters from anon;
grant select, insert, delete on table public.characters to authenticated;

create policy "Users can view their own characters"
on public.characters
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own characters"
on public.characters
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own characters"
on public.characters
for delete
to authenticated
using ((select auth.uid()) = user_id);
