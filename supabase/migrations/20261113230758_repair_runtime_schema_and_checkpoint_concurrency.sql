create or replace function public.character_level_from_experience(value bigint)
returns smallint
language plpgsql immutable parallel safe strict set search_path = '' as $$
declare
  lower_level integer := 1;
  upper_level integer := 32767;
  candidate_level integer;
begin
  if value <= 0 then
    return 1;
  end if;

  while lower_level < upper_level loop
    candidate_level := (lower_level + upper_level + 1) / 2;
    if (50::bigint * candidate_level * candidate_level * candidate_level - 150::bigint * candidate_level * candidate_level + 400::bigint * candidate_level) / 3 <= value then
      lower_level := candidate_level;
    else
      upper_level := candidate_level - 1;
    end if;
  end loop;

  return lower_level::smallint;
end; $$;

alter table public.characters
  add column if not exists avatar_url text,
  add column if not exists level smallint generated always as (public.character_level_from_experience(experience)) stored;

grant select, insert, update, delete on all tables in schema public to service_role;

create policy checkpoint_receipts_service_role
on public.character_hunt_checkpoint_receipts
for all to service_role
using (true)
with check (true);

revoke all on function public.give_starter_creature(uuid) from public, anon, authenticated;

create index if not exists character_battle_item_configuration_item_id_idx
on public.character_battle_item_configuration (item_id);
create index if not exists character_hunts_active_creature_id_idx
on public.character_hunts (active_creature_id);
create index if not exists character_hunts_character_id_user_id_idx
on public.character_hunts (character_id, user_id);
create index if not exists character_hunts_hunting_location_id_idx
on public.character_hunts (hunting_location_id);
create index if not exists creature_learned_moves_move_id_idx
on public.creature_learned_moves (move_id);
create index if not exists evolutions_required_item_id_idx
on public.evolutions (required_item_id);
create index if not exists hunting_location_species_species_id_idx
on public.hunting_location_species (species_id);
create index if not exists moves_type_id_idx
on public.moves (type_id);
create index if not exists type_effectiveness_defender_type_id_idx
on public.type_effectiveness (defender_type_id);

create or replace function public.checkpoint_character_hunt(
  expected_hunt_id uuid, expected_revision bigint, checkpoint_id uuid, next_active_creature_id uuid,
  next_active_creature_health integer, next_player_position jsonb, next_enemies jsonb, next_wave integer,
  next_event_time timestamptz, next_combat_events jsonb, next_ability_cooldowns jsonb, next_runtime_snapshot jsonb,
  experience_deltas jsonb default '[]'::jsonb, finish_hunt boolean default false
)
returns table (applied boolean, next_revision bigint, finished boolean)
language plpgsql security definer set search_path = '' as $$
declare
  receipt public.character_hunt_checkpoint_receipts%rowtype;
  locked_hunt public.character_hunts%rowtype;
  checkpoint_payload_fingerprint jsonb;
  experience_delta jsonb;
  updated_revision bigint;
begin
  if expected_hunt_id is null or expected_revision is null or expected_revision < 1 or checkpoint_id is null then
    raise exception using errcode = '22023', message = 'invalid_checkpoint_identity';
  end if;

  if experience_deltas is null or jsonb_typeof(experience_deltas) <> 'array' then
    raise exception using errcode = '22023', message = 'invalid_experience_deltas';
  end if;

  checkpoint_payload_fingerprint := jsonb_build_object(
    'activeCreatureHealth', next_active_creature_health,
    'activeCreatureId', next_active_creature_id,
    'abilityCooldowns', next_ability_cooldowns,
    'combatEvents', next_combat_events,
    'enemies', next_enemies,
    'expectedHuntId', expected_hunt_id,
    'expectedRevision', expected_revision,
    'experienceDeltas', experience_deltas,
    'finishHunt', finish_hunt,
    'nextEventTime', next_event_time,
    'playerPosition', next_player_position,
    'runtimeSnapshot', next_runtime_snapshot,
    'wave', next_wave
  );

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(checkpoint_id::text, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(expected_hunt_id::text, 0));

  select * into receipt
  from public.character_hunt_checkpoint_receipts
  where character_hunt_checkpoint_receipts.checkpoint_id = checkpoint_character_hunt.checkpoint_id;

  if found then
    if receipt.hunt_id <> expected_hunt_id
      or receipt.expected_revision <> expected_revision
      or receipt.payload_fingerprint <> checkpoint_payload_fingerprint
    then
      raise exception using errcode = '22023', message = 'checkpoint_payload_mismatch';
    end if;

    return query select true, receipt.resulting_revision, receipt.finished;
    return;
  end if;

  select * into locked_hunt
  from public.character_hunts
  where character_hunts.hunt_id = expected_hunt_id
  for update;

  if not found or locked_hunt.revision <> expected_revision then
    return query select false, null::bigint, false;
    return;
  end if;

  if finish_hunt then
    delete from public.character_hunts
    where character_hunts.hunt_id = expected_hunt_id;

    insert into public.character_hunt_checkpoint_receipts (
      checkpoint_id, hunt_id, expected_revision, payload_fingerprint, resulting_revision, finished
    ) values (
      checkpoint_id, expected_hunt_id, expected_revision, checkpoint_payload_fingerprint, expected_revision + 1, true
    );

    return query select true, expected_revision + 1, true;
    return;
  end if;

  for experience_delta in
    select value
    from jsonb_array_elements(experience_deltas)
    order by value ->> 'creatureId'
  loop
    if jsonb_typeof(experience_delta) <> 'object'
      or (experience_delta ->> 'creatureId') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      or (experience_delta ->> 'amount') !~ '^[0-9]+$'
    then
      raise exception using errcode = '22023', message = 'invalid_experience_delta';
    end if;

    update public.creatures
    set experience = creatures.experience + (experience_delta ->> 'amount')::bigint
    where creatures.id = (experience_delta ->> 'creatureId')::uuid
      and creatures.character_id = locked_hunt.character_id;
  end loop;

  update public.character_hunts
  set active_creature_id = next_active_creature_id,
    active_creature_health = next_active_creature_health,
    player_position = next_player_position,
    enemies = next_enemies,
    wave = next_wave,
    next_event_at = next_event_time,
    combat_events = next_combat_events,
    ability_cooldowns = next_ability_cooldowns,
    runtime_snapshot = next_runtime_snapshot,
    revision = revision + 1,
    updated_at = now()
  where character_hunts.hunt_id = expected_hunt_id
  returning revision into updated_revision;

  insert into public.character_hunt_checkpoint_receipts (
    checkpoint_id, hunt_id, expected_revision, payload_fingerprint, resulting_revision, finished
  ) values (
    checkpoint_id, expected_hunt_id, expected_revision, checkpoint_payload_fingerprint, updated_revision, false
  );

  return query select true, updated_revision, false;
end; $$;

revoke all on function public.checkpoint_character_hunt(uuid, bigint, uuid, uuid, integer, jsonb, jsonb, integer, timestamptz, jsonb, jsonb, jsonb, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.checkpoint_character_hunt(uuid, bigint, uuid, uuid, integer, jsonb, jsonb, integer, timestamptz, jsonb, jsonb, jsonb, jsonb, boolean) to service_role;
