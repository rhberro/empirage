alter table public.character_hunts
  add column hunt_id uuid not null default gen_random_uuid() unique,
  add column hunting_location_id smallint references public.hunting_locations (id),
  add column wave integer not null default 1 check (wave > 0),
  add column active_creature_id uuid references public.creatures (id),
  add column active_creature_health integer check (active_creature_health >= 0),
  add column player_position jsonb not null default '{"x":1,"y":1}'::jsonb,
  add column enemies jsonb not null default '[]'::jsonb,
  add column next_event_at timestamptz,
  add column state text not null default 'active' check (state in ('active', 'leaving')),
  add column revision bigint not null default 1 check (revision > 0),
  add column started_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();

delete from public.character_hunts
where hunting_location_id is null
  or active_creature_id is null
  or active_creature_health is null
  or next_event_at is null
  or jsonb_array_length(enemies) = 0;

alter table public.character_hunts
  alter column hunting_location_id set not null,
  alter column active_creature_id set not null,
  alter column active_creature_health set not null,
  alter column next_event_at set not null;

create or replace function public.validate_character_hunt_creature()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.creatures
    where creatures.id = new.active_creature_id
      and creatures.character_id = new.character_id
      and creatures.owner_user_id = new.user_id
      and creatures.status = 'active'
      and creatures.team_position is not null
  ) then
    raise exception using errcode = '23514', message = 'invalid_active_hunt_creature';
  end if;
  return new;
end;
$$;

create trigger validate_character_hunt_creature
before insert or update of active_creature_id, character_id, user_id
on public.character_hunts
for each row execute function public.validate_character_hunt_creature();

create index character_hunts_next_event_at_idx
on public.character_hunts (next_event_at)
where state = 'active';

revoke all on table public.character_hunts from anon, authenticated;
grant select on table public.character_hunts to authenticated;

create or replace function public.transition_character_hunt(
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
  finish_hunt boolean default false
)
returns setof public.character_hunts
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_hunt public.character_hunts%rowtype;
begin
  select * into locked_hunt
  from public.character_hunts
  where hunt_id = expected_hunt_id and revision = expected_revision
  for update;

  if not found then
    return;
  end if;

  if finish_hunt then
    return query
    delete from public.character_hunts where hunt_id = expected_hunt_id returning *;
    return;
  end if;

  if experience_gain > 0 then
    update public.creatures
    set experience = experience + experience_gain
    where id = experience_creature_id
      and character_id = locked_hunt.character_id
      and status = 'active';
    if not found then
      raise exception using errcode = '23514', message = 'invalid_experience_creature';
    end if;
  end if;

  return query
  update public.character_hunts
  set active_creature_id = next_active_creature_id,
      active_creature_health = next_active_creature_health,
      player_position = next_player_position,
      enemies = next_enemies,
      wave = next_wave,
      next_event_at = next_event_time,
      revision = revision + 1,
      updated_at = now()
  where hunt_id = expected_hunt_id and revision = expected_revision
  returning *;
end;
$$;

revoke execute on function public.transition_character_hunt(
  uuid, bigint, uuid, integer, jsonb, jsonb, integer, timestamptz, uuid, bigint, boolean
) from public, anon, authenticated;
grant execute on function public.transition_character_hunt(
  uuid, bigint, uuid, integer, jsonb, jsonb, integer, timestamptz, uuid, bigint, boolean
) to service_role;

create or replace function public.give_starter_creature(
  target_character_id uuid,
  target_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_creature_id uuid;
  starter_species smallint;
begin
  if exists (
    select 1 from public.creatures where character_id = target_character_id
  ) then
    return null;
  end if;

  starter_species := (array[1, 4, 7])[1 + floor(random() * 3)::integer];
  insert into public.creatures (
    species_id, character_id, owner_user_id, status, team_position, gender,
    experience, iv_health, iv_attack, iv_special_attack, iv_defense,
    iv_special_defense, iv_speed, captured_at
  ) values (
    starter_species, target_character_id, target_user_id, 'active', 1,
    case when random() < 0.5 then 'male' else 'female' end,
    0, 15, 15, 15, 15, 15, 15, now()
  ) returning id into created_creature_id;
  return created_creature_id;
end;
$$;

revoke execute on function public.give_starter_creature(uuid, uuid) from public, anon, authenticated;

select public.give_starter_creature(characters.id, characters.user_id)
from public.characters
where not exists (
  select 1 from public.creatures where creatures.character_id = characters.id
);

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
    raise exception using errcode = 'P0003', message = 'authentication_required';
  end if;
  if character_gender not in ('male', 'female') or character_gender is null then
    raise exception using errcode = '22023', message = 'invalid_character_gender';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(current_user_id::text, 0));
  select candidate.slot into available_slot
  from pg_catalog.generate_series(1, 5) as candidate(slot)
  where not exists (
    select 1 from public.characters
    where characters.user_id = current_user_id and characters.slot = candidate.slot
  )
  order by candidate.slot limit 1;

  if available_slot is null then
    raise exception using errcode = 'P0002', message = 'character_limit_reached';
  end if;

  begin
    insert into public.characters (user_id, slot, name, gender)
    values (current_user_id, available_slot, character_name, character_gender)
    returning id into created_character_id;
  exception when unique_violation then
    get stacked diagnostics violated_constraint = constraint_name;
    if violated_constraint = 'characters_name_normalized_key' then
      raise exception using errcode = 'P0001', message = 'character_name_unavailable';
    end if;
    raise;
  end;

  perform public.give_starter_creature(created_character_id, current_user_id);
  return created_character_id;
end;
$$;

revoke execute on function public.create_character(text, text) from public, anon;
grant execute on function public.create_character(text, text) to authenticated;
