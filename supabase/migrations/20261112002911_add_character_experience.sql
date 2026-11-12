create or replace function public.character_experience_for_level(character_level integer)
returns bigint
language sql
immutable
parallel safe
as $$
  select (50::bigint * character_level * character_level * character_level
    - 150::bigint * character_level * character_level
    + 400::bigint * character_level) / 3;
$$;

create or replace function public.character_level_from_experience(character_experience bigint)
returns smallint
language plpgsql
immutable
parallel safe
as $$
declare
  lower_level integer := 1;
  upper_level integer := 32767;
  candidate_level integer;
begin
  if character_experience <= 0 then
    return 1;
  end if;

  while lower_level < upper_level loop
    candidate_level := (lower_level + upper_level + 1) / 2;

    if public.character_experience_for_level(candidate_level) <= character_experience then
      lower_level := candidate_level;
    else
      upper_level := candidate_level - 1;
    end if;
  end loop;

  return lower_level::smallint;
end;
$$;

alter table public.characters
  add column experience bigint not null default 0
  constraint characters_experience_nonnegative check (experience >= 0);

update public.characters
set experience = public.character_experience_for_level(level);

alter table public.characters
  drop column level;

alter table public.characters
  add column level smallint generated always as (
    public.character_level_from_experience(experience)
  ) stored;

revoke all on function public.character_experience_for_level(integer) from public, anon, authenticated;
revoke all on function public.character_level_from_experience(bigint) from public, anon, authenticated;
