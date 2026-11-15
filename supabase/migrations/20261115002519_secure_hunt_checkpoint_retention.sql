create table public.character_hunt_completion_commands (
  checkpoint_id uuid primary key,
  hunt_id uuid not null,
  expected_revision bigint not null check (expected_revision > 0),
  resulting_revision bigint not null check (resulting_revision > expected_revision),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 day'
);

create index character_hunt_completion_commands_expires_at_idx
on public.character_hunt_completion_commands (expires_at);

alter table public.character_hunt_completion_commands enable row level security;
revoke all on table public.character_hunt_completion_commands from public, anon, authenticated;
grant select, insert, update, delete on public.character_hunt_completion_commands to service_role;

create or replace function public.checkpoint_character_hunt(
  expected_hunt_id uuid, expected_revision bigint, checkpoint_id uuid, next_active_creature_id uuid,
  next_active_creature_health integer, next_player_position jsonb, next_enemies jsonb, next_wave integer,
  next_event_time timestamptz, next_combat_events jsonb, next_ability_cooldowns jsonb, next_runtime_snapshot jsonb,
  experience_deltas jsonb default '[]'::jsonb, finish_hunt boolean default false
)
returns table (applied boolean, next_revision bigint, finished boolean)
language plpgsql security definer set search_path = '' as $$
declare
  completion public.character_hunt_completion_commands%rowtype;
  locked_hunt public.character_hunts%rowtype;
  experience_delta jsonb;
  updated_revision bigint;
begin
  if expected_hunt_id is null or expected_revision is null or expected_revision < 1 or checkpoint_id is null then
    raise exception using errcode = '22023', message = 'invalid_checkpoint_identity';
  end if;

  if experience_deltas is null or jsonb_typeof(experience_deltas) <> 'array' then
    raise exception using errcode = '22023', message = 'invalid_experience_deltas';
  end if;

  delete from public.character_hunt_completion_commands
  where checkpoint_id in (
    select checkpoint_id
    from public.character_hunt_completion_commands
    where expires_at < now()
    order by expires_at
    limit 100
  );

  select * into completion
  from public.character_hunt_completion_commands
  where character_hunt_completion_commands.checkpoint_id = checkpoint_character_hunt.checkpoint_id;

  if found then
    if not finish_hunt
      or completion.hunt_id <> expected_hunt_id
      or completion.expected_revision <> expected_revision
    then
      raise exception using errcode = '22023', message = 'checkpoint_identity_mismatch';
    end if;

    return query select true, completion.resulting_revision, true;
    return;
  end if;

  select * into locked_hunt
  from public.character_hunts
  where character_hunts.hunt_id = expected_hunt_id
  for update;

  if not found then
    return query select false, null::bigint, false;
    return;
  end if;

  if locked_hunt.last_checkpoint_id = checkpoint_id then
    return query select true, locked_hunt.revision, false;
    return;
  end if;

  if locked_hunt.revision <> expected_revision then
    return query select false, null::bigint, false;
    return;
  end if;

  if finish_hunt then
    delete from public.character_hunts
    where character_hunts.hunt_id = expected_hunt_id;

    insert into public.character_hunt_completion_commands (
      checkpoint_id, hunt_id, expected_revision, resulting_revision
    ) values (
      checkpoint_id, expected_hunt_id, expected_revision, expected_revision + 1
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
    updated_at = now(),
    last_checkpoint_id = checkpoint_id
  where character_hunts.hunt_id = expected_hunt_id
  returning revision into updated_revision;

  return query select true, updated_revision, false;
end;
$$;

revoke all on function public.checkpoint_character_hunt(uuid, bigint, uuid, uuid, integer, jsonb, jsonb, integer, timestamptz, jsonb, jsonb, jsonb, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.checkpoint_character_hunt(uuid, bigint, uuid, uuid, integer, jsonb, jsonb, integer, timestamptz, jsonb, jsonb, jsonb, jsonb, boolean) to service_role;
