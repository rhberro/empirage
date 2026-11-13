create table public.creature_equipped_abilities (
  creature_id uuid not null references public.creatures (id) on delete cascade,
  ability_id smallint not null references public.abilities (id),
  slot smallint not null check (slot between 1 and 4),
  primary key (creature_id, slot),
  unique (creature_id, ability_id)
);

alter table public.creature_equipped_abilities enable row level security;
revoke all on table public.creature_equipped_abilities from anon, authenticated;
grant select on table public.creature_equipped_abilities to authenticated;
grant select, insert, update, delete on table public.creature_equipped_abilities to service_role;

create policy creature_equipped_abilities_select_own
on public.creature_equipped_abilities for select to authenticated
using (
  exists (
    select 1 from public.creatures
    where creatures.id = creature_equipped_abilities.creature_id
      and creatures.owner_user_id = auth.uid()
  )
);

create or replace function public.fill_initial_creature_abilities()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.creature_equipped_abilities (creature_id, ability_id, slot)
  select new.id, available.ability_id, row_number() over (order by available.slot)::smallint
  from (
    select species_abilities.ability_id, species_abilities.slot
    from public.creature_species_abilities species_abilities
    join public.abilities on abilities.id = species_abilities.ability_id
    where species_abilities.species_id = new.species_id
      and abilities.kind = 'move'
      and abilities.required_level <= new.level
    order by species_abilities.slot, abilities.required_level, abilities.id
    limit 4
  ) available
  on conflict do nothing;
  return new;
end;
$$;

revoke execute on function public.fill_initial_creature_abilities() from public, anon, authenticated;

create trigger fill_initial_creature_abilities
after insert on public.creatures
for each row execute function public.fill_initial_creature_abilities();

insert into public.creature_equipped_abilities (creature_id, ability_id, slot)
select creatures.id, available.ability_id, available.equipped_slot
from public.creatures
cross join lateral (
  select species_abilities.ability_id,
    row_number() over (order by species_abilities.slot, abilities.required_level, abilities.id)::smallint
      as equipped_slot
  from public.creature_species_abilities species_abilities
  join public.abilities on abilities.id = species_abilities.ability_id
  where species_abilities.species_id = creatures.species_id
    and abilities.kind = 'move'
    and abilities.required_level <= creatures.level
  order by species_abilities.slot, abilities.required_level, abilities.id
  limit 4
) available
on conflict do nothing;

alter table public.character_hunts
  add column combat_events jsonb not null default '[]'::jsonb,
  add column ability_cooldowns jsonb not null default '{}'::jsonb;

drop function public.transition_character_hunt(
  uuid, bigint, uuid, integer, jsonb, jsonb, integer, timestamptz, uuid, bigint, boolean
);

create function public.transition_character_hunt(
  expected_hunt_id uuid,
  expected_revision bigint,
  next_active_creature_id uuid,
  next_active_creature_health integer,
  next_player_position jsonb,
  next_enemies jsonb,
  next_wave integer,
  next_event_time timestamptz,
  experience_creature_id uuid default null,
  experience_gain bigint default 0,
  finish_hunt boolean default false,
  next_combat_events jsonb default '[]'::jsonb,
  next_ability_cooldowns jsonb default '{}'::jsonb
)
returns setof public.character_hunts
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_hunt public.character_hunts%rowtype;
begin
  select * into locked_hunt from public.character_hunts
  where hunt_id = expected_hunt_id and revision = expected_revision for update;
  if not found then return; end if;
  if finish_hunt then
    return query delete from public.character_hunts
      where hunt_id = expected_hunt_id returning *;
    return;
  end if;
  if experience_gain > 0 then
    update public.creatures set experience = experience + experience_gain
    where id = experience_creature_id
      and character_id = locked_hunt.character_id and status = 'active';
    if not found then
      raise exception using errcode = '23514', message = 'invalid_experience_creature';
    end if;
  end if;
  return query update public.character_hunts
  set active_creature_id = next_active_creature_id,
      active_creature_health = next_active_creature_health,
      player_position = next_player_position,
      enemies = next_enemies,
      wave = next_wave,
      next_event_at = next_event_time,
      combat_events = next_combat_events,
      ability_cooldowns = next_ability_cooldowns,
      revision = revision + 1,
      updated_at = now()
  where hunt_id = expected_hunt_id and revision = expected_revision returning *;
end;
$$;

revoke execute on function public.transition_character_hunt(
  uuid, bigint, uuid, integer, jsonb, jsonb, integer, timestamptz, uuid, bigint, boolean, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.transition_character_hunt(
  uuid, bigint, uuid, integer, jsonb, jsonb, integer, timestamptz, uuid, bigint, boolean, jsonb, jsonb
) to service_role;
