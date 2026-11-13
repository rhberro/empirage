create table public.character_hunt_checkpoint_receipts (
  checkpoint_id uuid primary key,
  hunt_id uuid not null,
  expected_revision bigint not null check (expected_revision >= 0),
  payload_fingerprint jsonb not null,
  resulting_revision bigint not null check (resulting_revision > expected_revision),
  finished boolean not null,
  created_at timestamptz not null default now()
);

create index character_hunt_checkpoint_receipts_hunt_id_idx
on public.character_hunt_checkpoint_receipts (hunt_id);

create index character_hunt_checkpoint_receipts_created_at_idx
on public.character_hunt_checkpoint_receipts (created_at);

comment on table public.character_hunt_checkpoint_receipts is
'Idempotency receipts may reach 28,800 rows per hunt per day. Retain receipts for the longer of seven days or the configured maximum checkpoint retry window; cleanup is an operator-managed batch after retries can no longer occur.';

alter table public.character_hunts
add column runtime_snapshot jsonb null,
add constraint character_hunts_runtime_snapshot_object_check
check (runtime_snapshot is null or jsonb_typeof(runtime_snapshot) = 'object');

alter table public.character_hunt_checkpoint_receipts enable row level security;

revoke all on table public.character_hunt_checkpoint_receipts from public, anon, authenticated;
grant select, insert on table public.character_hunt_checkpoint_receipts to service_role;

create function public.checkpoint_character_hunt(
  expected_hunt_id uuid,
  expected_revision bigint,
  checkpoint_id uuid,
  next_active_creature_id uuid,
  next_active_creature_health integer,
  next_player_position jsonb,
  next_enemies jsonb,
  next_wave integer,
  next_event_time timestamptz,
  next_combat_events jsonb,
  next_ability_cooldowns jsonb,
  next_runtime_snapshot jsonb,
  experience_deltas jsonb default '[]'::jsonb,
  finish_hunt boolean default false
)
returns table (applied boolean, next_revision bigint, finished boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_hunt public.character_hunts%rowtype;
  existing_receipt public.character_hunt_checkpoint_receipts%rowtype;
  resulting_revision bigint;
  delta_count bigint;
  updated_count bigint;
  checkpoint_payload_fingerprint jsonb;
begin
  if expected_revision is null or expected_revision < 0 or expected_revision > 9007199254740991 then
    raise exception using errcode = '22023', message = 'invalid_expected_revision';
  end if;

  checkpoint_payload_fingerprint := jsonb_build_object(
    'huntId', expected_hunt_id,
    'expectedRevision', expected_revision,
    'activeCreatureId', next_active_creature_id,
    'activeCreatureHealth', next_active_creature_health,
    'playerPosition', next_player_position,
    'enemies', next_enemies,
    'wave', next_wave,
    'nextEventTimeEpoch', extract(epoch from next_event_time),
    'combatEvents', next_combat_events,
    'abilityCooldowns', next_ability_cooldowns,
    'runtimeSnapshot', next_runtime_snapshot,
    'experienceDeltas', experience_deltas,
    'finishHunt', finish_hunt
  );

  select * into existing_receipt
  from public.character_hunt_checkpoint_receipts as receipts
  where receipts.checkpoint_id = checkpoint_character_hunt.checkpoint_id;

  if found then
    if existing_receipt.hunt_id <> expected_hunt_id
      or existing_receipt.expected_revision <> checkpoint_character_hunt.expected_revision
      or existing_receipt.payload_fingerprint <> checkpoint_payload_fingerprint
    then
      raise exception using errcode = '22023', message = 'checkpoint_payload_mismatch';
    end if;

    return query select
      true,
      existing_receipt.resulting_revision,
      existing_receipt.finished;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(checkpoint_character_hunt.checkpoint_id::text, 0)
  );

  select * into existing_receipt
  from public.character_hunt_checkpoint_receipts as receipts
  where receipts.checkpoint_id = checkpoint_character_hunt.checkpoint_id;

  if found then
    if existing_receipt.hunt_id <> expected_hunt_id
      or existing_receipt.expected_revision <> checkpoint_character_hunt.expected_revision
      or existing_receipt.payload_fingerprint <> checkpoint_payload_fingerprint
    then
      raise exception using errcode = '22023', message = 'checkpoint_payload_mismatch';
    end if;

    return query select
      true,
      existing_receipt.resulting_revision,
      existing_receipt.finished;
    return;
  end if;

  select * into locked_hunt
  from public.character_hunts as hunts
  where hunts.hunt_id = expected_hunt_id
  for update;

  if not found or locked_hunt.revision <> expected_revision then
    return query select false, null::bigint, false;
    return;
  end if;

  select * into existing_receipt
  from public.character_hunt_checkpoint_receipts as receipts
  where receipts.checkpoint_id = checkpoint_character_hunt.checkpoint_id;

  if found then
    if existing_receipt.hunt_id <> expected_hunt_id
      or existing_receipt.expected_revision <> checkpoint_character_hunt.expected_revision
      or existing_receipt.payload_fingerprint <> checkpoint_payload_fingerprint
    then
      raise exception using errcode = '22023', message = 'checkpoint_payload_mismatch';
    end if;

    return query select
      true,
      existing_receipt.resulting_revision,
      existing_receipt.finished;
    return;
  end if;

  if experience_deltas is null or jsonb_typeof(experience_deltas) <> 'array' then
    raise exception using errcode = '22023', message = 'invalid_experience_deltas';
  end if;

  if next_runtime_snapshot is null or jsonb_typeof(next_runtime_snapshot) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_runtime_snapshot';
  end if;

  if jsonb_typeof(next_runtime_snapshot -> 'version') is distinct from 'number'
    or jsonb_typeof(next_runtime_snapshot -> 'huntId') is distinct from 'string'
    or jsonb_typeof(next_runtime_snapshot -> 'runtimeGeneration') is distinct from 'string'
    or jsonb_typeof(next_runtime_snapshot -> 'capturedAt') is distinct from 'number'
    or jsonb_typeof(next_runtime_snapshot -> 'enemyActionNotBefore') is distinct from 'number'
    or jsonb_typeof(next_runtime_snapshot -> 'nextEventAt') is distinct from 'number'
    or jsonb_typeof(next_runtime_snapshot -> 'revision') is distinct from 'number'
    or jsonb_typeof(next_runtime_snapshot -> 'activeCreatureId') is distinct from 'string'
    or jsonb_typeof(next_runtime_snapshot -> 'activeCreatureHealth') is distinct from 'number'
    or jsonb_typeof(next_runtime_snapshot -> 'enemies') is distinct from 'array'
    or jsonb_typeof(next_runtime_snapshot -> 'playerPosition') is distinct from 'object'
    or jsonb_typeof(next_runtime_snapshot #> '{playerPosition,x}') is distinct from 'number'
    or jsonb_typeof(next_runtime_snapshot #> '{playerPosition,y}') is distinct from 'number'
    or jsonb_typeof(next_runtime_snapshot -> 'wave') is distinct from 'number'
    or jsonb_typeof(next_runtime_snapshot -> 'waveSize') is distinct from 'number'
    or jsonb_typeof(next_runtime_snapshot -> 'waveDelayMs') is distinct from 'number'
    or jsonb_typeof(next_runtime_snapshot -> 'abilityCooldowns') is distinct from 'object'
    or (next_runtime_snapshot ? 'xpPending'
      and jsonb_typeof(next_runtime_snapshot -> 'xpPending') is distinct from 'object')
  then
    raise exception using errcode = '22023', message = 'invalid_runtime_snapshot_structure';
  end if;

  if (next_runtime_snapshot ? 'xpPending'
      and next_runtime_snapshot -> 'xpPending' <> '{}'::jsonb)
    or (next_runtime_snapshot ->> 'version') !~ '^1$'
    or (next_runtime_snapshot ->> 'capturedAt') !~ '^[0-9]+$'
    or (next_runtime_snapshot ->> 'enemyActionNotBefore') !~ '^[0-9]+$'
    or (next_runtime_snapshot ->> 'nextEventAt') !~ '^[0-9]+$'
    or (next_runtime_snapshot ->> 'revision') !~ '^[0-9]+$'
    or (next_runtime_snapshot ->> 'activeCreatureHealth') !~ '^[0-9]+$'
    or (next_runtime_snapshot #>> '{playerPosition,x}') !~ '^-?[0-9]+$'
    or (next_runtime_snapshot #>> '{playerPosition,y}') !~ '^-?[0-9]+$'
    or (next_runtime_snapshot ->> 'wave') !~ '^[0-9]+$'
    or (next_runtime_snapshot ->> 'waveSize') !~ '^[0-9]+$'
    or (next_runtime_snapshot ->> 'waveDelayMs') !~ '^[0-9]+$'
    or (next_runtime_snapshot ->> 'huntId') !~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    or (next_runtime_snapshot ->> 'runtimeGeneration') !~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    or (next_runtime_snapshot ->> 'activeCreatureId') !~ (
      case when finish_hunt then
        '^(|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$'
      else
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      end
    )
  then
    raise exception using errcode = '22023', message = 'invalid_runtime_snapshot_value';
  end if;

  if (next_runtime_snapshot ->> 'capturedAt')::numeric > 9007199254740991
    or (next_runtime_snapshot ->> 'enemyActionNotBefore')::numeric > 9007199254740991
    or (next_runtime_snapshot ->> 'nextEventAt')::numeric > 9007199254740991
    or (next_runtime_snapshot ->> 'revision')::numeric > 9007199254740991
    or (next_runtime_snapshot ->> 'activeCreatureHealth')::numeric > 9007199254740991
    or (next_runtime_snapshot #>> '{playerPosition,x}')::numeric not between -9007199254740991 and 9007199254740991
    or (next_runtime_snapshot #>> '{playerPosition,y}')::numeric not between -9007199254740991 and 9007199254740991
    or (next_runtime_snapshot ->> 'wave')::numeric not between 1 and 9007199254740991
    or (next_runtime_snapshot ->> 'waveSize')::numeric not between 1 and 5
    or (next_runtime_snapshot ->> 'waveDelayMs')::numeric > 9007199254740991
    or (next_runtime_snapshot ->> 'huntId')::uuid <> expected_hunt_id
  then
    raise exception using errcode = '22023', message = 'invalid_runtime_snapshot_value';
  end if;

  if next_player_position is null
    or next_enemies is null
    or next_ability_cooldowns is null
    or next_event_time is null
    or next_active_creature_health is null
    or next_wave is null
    or (not finish_hunt and next_active_creature_id is null)
    or jsonb_typeof(next_player_position) <> 'object'
    or jsonb_typeof(next_enemies) <> 'array'
    or jsonb_typeof(next_ability_cooldowns) <> 'object'
  then
    raise exception using errcode = '22023', message = 'invalid_checkpoint_state';
  end if;

  if next_runtime_snapshot -> 'playerPosition' <> next_player_position
    or next_runtime_snapshot -> 'enemies' <> next_enemies
    or next_runtime_snapshot -> 'abilityCooldowns' <> next_ability_cooldowns
    or (next_runtime_snapshot ->> 'activeCreatureHealth')::numeric <> next_active_creature_health
    or (next_runtime_snapshot ->> 'wave')::numeric <> next_wave
    or (next_runtime_snapshot ->> 'nextEventAt')::numeric <>
      extract(epoch from next_event_time)::numeric * 1000
    or (not finish_hunt
      and (next_runtime_snapshot ->> 'activeCreatureId')::uuid <> next_active_creature_id)
  then
    raise exception using errcode = '22023', message = 'runtime_snapshot_state_mismatch';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(next_runtime_snapshot -> 'enemies') as enemy(value)
    where jsonb_typeof(enemy.value) is distinct from 'object'
      or jsonb_typeof(enemy.value -> 'position') is distinct from 'object'
      or jsonb_typeof(enemy.value #> '{position,x}') is distinct from 'number'
      or jsonb_typeof(enemy.value #> '{position,y}') is distinct from 'number'
      or jsonb_typeof(enemy.value -> 'health') is distinct from 'number'
      or jsonb_typeof(enemy.value -> 'nextAttackAt') is distinct from 'number'
      or jsonb_typeof(enemy.value -> 'combatId') is distinct from 'string'
      or jsonb_typeof(enemy.value -> 'id') is distinct from 'number'
      or jsonb_typeof(enemy.value -> 'level') is distinct from 'number'
      or jsonb_typeof(enemy.value -> 'maximumHealth') is distinct from 'number'
      or jsonb_typeof(enemy.value -> 'baseAttack') is distinct from 'number'
      or jsonb_typeof(enemy.value -> 'baseDefense') is distinct from 'number'
      or jsonb_typeof(enemy.value -> 'baseSpeed') is distinct from 'number'
      or jsonb_typeof(enemy.value -> 'baseHealth') is distinct from 'number'
      or jsonb_typeof(enemy.value -> 'name') is distinct from 'string'
      or jsonb_typeof(enemy.value -> 'abilities') is distinct from 'array'
      or (enemy.value ? 'movement' and (
        jsonb_typeof(enemy.value -> 'movement') is distinct from 'object'
        or jsonb_typeof(enemy.value #> '{movement,startTime}') is distinct from 'number'
        or jsonb_typeof(enemy.value #> '{movement,startTick}') is distinct from 'number'
        or jsonb_typeof(enemy.value #> '{movement,durationTicks}') is distinct from 'number'
        or jsonb_typeof(enemy.value #> '{movement,fromTile}') is distinct from 'object'
        or jsonb_typeof(enemy.value #> '{movement,fromTile,x}') is distinct from 'number'
        or jsonb_typeof(enemy.value #> '{movement,fromTile,y}') is distinct from 'number'
        or jsonb_typeof(enemy.value #> '{movement,toTile}') is distinct from 'object'
        or jsonb_typeof(enemy.value #> '{movement,toTile,x}') is distinct from 'number'
        or jsonb_typeof(enemy.value #> '{movement,toTile,y}') is distinct from 'number'
        or jsonb_typeof(enemy.value #> '{movement,movementId}') is distinct from 'string'
        or jsonb_typeof(enemy.value #> '{movement,direction}') is distinct from 'string'
        or jsonb_typeof(enemy.value #> '{movement,mode}') is distinct from 'string'
      ))
  ) then
    raise exception using errcode = '22023', message = 'invalid_runtime_snapshot_enemy';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(next_runtime_snapshot -> 'enemies') as enemy(value)
    where (enemy.value #>> '{position,x}') !~ '^-?[0-9]+$'
      or (enemy.value #>> '{position,y}') !~ '^-?[0-9]+$'
      or (enemy.value ->> 'health') !~ '^[0-9]+$'
      or (enemy.value ->> 'nextAttackAt') !~ '^[0-9]+$'
      or (enemy.value ->> 'id') !~ '^[0-9]+$'
      or (enemy.value ->> 'level') !~ '^[0-9]+$'
      or (enemy.value ->> 'maximumHealth') !~ '^[0-9]+$'
      or (enemy.value ->> 'baseAttack') !~ '^[0-9]+$'
      or (enemy.value ->> 'baseDefense') !~ '^[0-9]+$'
      or (enemy.value ->> 'baseSpeed') !~ '^[0-9]+$'
      or (enemy.value ->> 'baseHealth') !~ '^[0-9]+$'
      or enemy.value ->> 'combatId' = ''
      or enemy.value ->> 'name' = ''
      or (enemy.value ? 'movement' and (
        (enemy.value #>> '{movement,startTime}') !~ '^[0-9]+$'
        or (enemy.value #>> '{movement,startTick}') !~ '^[0-9]+$'
        or (enemy.value #>> '{movement,durationTicks}') !~ '^[0-9]+$'
        or (enemy.value #>> '{movement,fromTile,x}') !~ '^-?[0-9]+$'
        or (enemy.value #>> '{movement,fromTile,y}') !~ '^-?[0-9]+$'
        or (enemy.value #>> '{movement,toTile,x}') !~ '^-?[0-9]+$'
        or (enemy.value #>> '{movement,toTile,y}') !~ '^-?[0-9]+$'
        or (enemy.value #>> '{movement,movementId}') !~
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        or (enemy.value #>> '{movement,direction}') not in
          ('down', 'left', 'right', 'up', 'down-left', 'down-right', 'up-left', 'up-right')
        or (enemy.value #>> '{movement,mode}') not in ('running', 'walking')
      ))
  ) then
    raise exception using errcode = '22023', message = 'invalid_runtime_snapshot_enemy';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(next_runtime_snapshot -> 'enemies') as enemy(value)
    where (enemy.value #>> '{position,x}')::numeric not between -9007199254740991 and 9007199254740991
      or (enemy.value #>> '{position,y}')::numeric not between -9007199254740991 and 9007199254740991
      or (enemy.value ->> 'health')::numeric > 9007199254740991
      or (enemy.value ->> 'nextAttackAt')::numeric > 9007199254740991
      or (enemy.value ->> 'id')::numeric not between 1 and 9007199254740991
      or (enemy.value ->> 'level')::numeric not between 1 and 9007199254740991
      or (enemy.value ->> 'maximumHealth')::numeric not between 1 and 9007199254740991
      or (enemy.value ->> 'baseAttack')::numeric > 9007199254740991
      or (enemy.value ->> 'baseDefense')::numeric > 9007199254740991
      or (enemy.value ->> 'baseSpeed')::numeric > 9007199254740991
      or (enemy.value ->> 'baseHealth')::numeric > 9007199254740991
      or (enemy.value ->> 'health')::numeric > (enemy.value ->> 'maximumHealth')::numeric
      or (enemy.value ->> 'maximumHealth')::numeric <>
        (enemy.value ->> 'baseHealth')::numeric + (enemy.value ->> 'level')::numeric
      or (enemy.value ? 'movement' and (
        (enemy.value #>> '{movement,startTime}')::numeric > 9007199254740991
        or (enemy.value #>> '{movement,startTick}')::numeric > 9007199254740991
        or (enemy.value #>> '{movement,durationTicks}')::numeric not between 1 and 9007199254740991
        or (enemy.value #>> '{movement,fromTile,x}')::numeric not between -9007199254740991 and 9007199254740991
        or (enemy.value #>> '{movement,fromTile,y}')::numeric not between -9007199254740991 and 9007199254740991
        or (enemy.value #>> '{movement,toTile,x}')::numeric not between -9007199254740991 and 9007199254740991
        or (enemy.value #>> '{movement,toTile,y}')::numeric not between -9007199254740991 and 9007199254740991
      ))
  ) then
    raise exception using errcode = '22023', message = 'invalid_runtime_snapshot_enemy';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(next_runtime_snapshot -> 'enemies') as enemy(value)
    cross join lateral jsonb_array_elements(enemy.value -> 'abilities') as ability(value)
    where jsonb_typeof(ability.value) is distinct from 'object'
      or jsonb_typeof(ability.value -> 'category') is distinct from 'string'
      or jsonb_typeof(ability.value -> 'cooldownMs') is distinct from 'number'
      or jsonb_typeof(ability.value -> 'id') is distinct from 'number'
      or jsonb_typeof(ability.value -> 'isFire') is distinct from 'boolean'
      or jsonb_typeof(ability.value -> 'requiredLevel') is distinct from 'number'
      or jsonb_typeof(ability.value -> 'slot') is distinct from 'number'
  ) then
    raise exception using errcode = '22023', message = 'invalid_runtime_snapshot_enemy_ability';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(next_runtime_snapshot -> 'enemies') as enemy(value)
    cross join lateral jsonb_array_elements(enemy.value -> 'abilities') as ability(value)
    where (ability.value ->> 'category') not in ('physical', 'special', 'status')
      or (ability.value ->> 'cooldownMs') !~ '^[0-9]+$'
      or (ability.value ->> 'id') !~ '^[0-9]+$'
      or (ability.value ->> 'requiredLevel') !~ '^[0-9]+$'
      or (ability.value ->> 'slot') !~ '^[0-9]+$'
  ) then
    raise exception using errcode = '22023', message = 'invalid_runtime_snapshot_enemy_ability';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(next_runtime_snapshot -> 'enemies') as enemy(value)
    cross join lateral jsonb_array_elements(enemy.value -> 'abilities') as ability(value)
    where (ability.value ->> 'cooldownMs')::numeric > 9007199254740991
      or (ability.value ->> 'id')::numeric not between 1 and 9007199254740991
      or (ability.value ->> 'requiredLevel')::numeric > 9007199254740991
      or (ability.value ->> 'slot')::numeric > 9007199254740991
  ) then
    raise exception using errcode = '22023', message = 'invalid_runtime_snapshot_enemy_ability';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(experience_deltas) as delta(value)
    where jsonb_typeof(delta.value) is distinct from 'object'
      or jsonb_typeof(delta.value -> 'creatureId') is distinct from 'string'
      or jsonb_typeof(delta.value -> 'amount') is distinct from 'number'
      or (delta.value ->> 'creatureId') !~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      or (delta.value ->> 'amount') !~ '^[0-9]+$'
  ) then
    raise exception using errcode = '22023', message = 'invalid_experience_deltas';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(experience_deltas) as delta(value)
    where (delta.value ->> 'amount')::numeric > 9223372036854775807
  ) then
    raise exception using errcode = '22003', message = 'experience_overflow';
  end if;

  with deltas as (
    select
      (delta.value ->> 'creatureId')::uuid as creature_id,
      sum((delta.value ->> 'amount')::numeric) as amount
    from jsonb_array_elements(experience_deltas) as delta(value)
    group by (delta.value ->> 'creatureId')::uuid
  )
  select count(*) into delta_count
  from deltas
  where amount > 9223372036854775807;

  if delta_count > 0 then
    raise exception using errcode = '22003', message = 'experience_overflow';
  end if;

  with deltas as (
    select
      (delta.value ->> 'creatureId')::uuid as creature_id,
      sum((delta.value ->> 'amount')::numeric)::bigint as amount
    from jsonb_array_elements(experience_deltas) as delta(value)
    group by (delta.value ->> 'creatureId')::uuid
  ), updated as (
    update public.creatures as creatures
    set experience = creatures.experience + deltas.amount
    from deltas
    where creatures.id = deltas.creature_id
      and creatures.character_id = locked_hunt.character_id
      and creatures.status = 'active'
      and creatures.experience <= 9223372036854775807 - deltas.amount
    returning creatures.id
  )
  select
    (select count(*) from deltas),
    (select count(*) from updated)
  into delta_count, updated_count;

  if delta_count <> updated_count then
    raise exception using errcode = '23514', message = 'invalid_experience_creature';
  end if;

  resulting_revision := expected_revision + 1;

  if finish_hunt then
    delete from public.character_hunts as hunts
    where hunts.hunt_id = expected_hunt_id;
  else
    update public.character_hunts as hunts
    set active_creature_id = next_active_creature_id,
        active_creature_health = next_active_creature_health,
        player_position = next_player_position,
        enemies = next_enemies,
        wave = next_wave,
        next_event_at = next_event_time,
        combat_events = next_combat_events,
        ability_cooldowns = next_ability_cooldowns,
        runtime_snapshot = next_runtime_snapshot,
        revision = resulting_revision,
        updated_at = now()
    where hunts.hunt_id = expected_hunt_id;
  end if;

  insert into public.character_hunt_checkpoint_receipts (
    checkpoint_id,
    hunt_id,
    expected_revision,
    payload_fingerprint,
    resulting_revision,
    finished
  ) values (
    checkpoint_character_hunt.checkpoint_id,
    expected_hunt_id,
    expected_revision,
    checkpoint_payload_fingerprint,
    resulting_revision,
    finish_hunt
  );

  return query select true, resulting_revision, finish_hunt;
end;
$$;

revoke execute on function public.checkpoint_character_hunt(
  uuid, bigint, uuid, uuid, integer, jsonb, jsonb, integer, timestamptz,
  jsonb, jsonb, jsonb, jsonb, boolean
) from public, anon, authenticated;

grant execute on function public.checkpoint_character_hunt(
  uuid, bigint, uuid, uuid, integer, jsonb, jsonb, integer, timestamptz,
  jsonb, jsonb, jsonb, jsonb, boolean
) to service_role;

comment on function public.checkpoint_character_hunt(
  uuid, bigint, uuid, uuid, integer, jsonb, jsonb, integer, timestamptz,
  jsonb, jsonb, jsonb, jsonb, boolean
) is
'Returns one row: applied=true with the persisted revision for an applied or identical retried checkpoint; applied=false with next_revision=null on revision conflict. Payload mismatches and invalid or uncertain writes raise an error.';
