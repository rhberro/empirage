alter table public.character_hunts
  add column last_checkpoint_id uuid;

drop function public.checkpoint_character_hunt(uuid, bigint, uuid, uuid, integer, jsonb, jsonb, integer, timestamptz, jsonb, jsonb, jsonb, jsonb, boolean);

drop table public.character_hunt_checkpoint_receipts;

create table public.character_capture_commands (
  command_id uuid primary key,
  character_id uuid not null references public.characters (id) on delete cascade,
  gold bigint,
  creature_id uuid references public.creatures (id) on delete set null,
  party_slot smallint,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 day'
);

create index character_capture_commands_expires_at_idx
on public.character_capture_commands (expires_at);

alter table public.character_capture_commands enable row level security;
revoke all on public.character_capture_commands from anon, authenticated;
grant select, insert, update, delete on public.character_capture_commands to service_role;

drop function public.complete_character_capture(uuid, smallint, smallint, smallint, text, text, smallint, smallint, smallint, smallint, smallint, smallint, boolean);

create or replace function public.checkpoint_character_hunt(
  expected_hunt_id uuid, expected_revision bigint, checkpoint_id uuid, next_active_creature_id uuid,
  next_active_creature_health integer, next_player_position jsonb, next_enemies jsonb, next_wave integer,
  next_event_time timestamptz, next_combat_events jsonb, next_ability_cooldowns jsonb, next_runtime_snapshot jsonb,
  experience_deltas jsonb default '[]'::jsonb, finish_hunt boolean default false
)
returns table (applied boolean, next_revision bigint, finished boolean)
language plpgsql security definer set search_path = '' as $$
declare
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

create or replace function public.complete_character_capture(
  command_id uuid,
  target_character_id uuid,
  target_item_id smallint,
  target_species_id smallint,
  target_level smallint,
  target_rarity text,
  target_gender text,
  target_iv_hp smallint,
  target_iv_attack smallint,
  target_iv_defense smallint,
  target_iv_special_attack smallint,
  target_iv_special_defense smallint,
  target_iv_speed smallint,
  capture_succeeded boolean
)
returns table (gold bigint, creature_id uuid, party_slot smallint)
language plpgsql security definer set search_path = '' as $$
declare
  available_party_slot smallint;
  created_creature_id uuid;
  existing_command public.character_capture_commands%rowtype;
  resulting_gold bigint;
begin
  if command_id is null
    or target_level < 1
    or target_gender not in ('male', 'female')
    or target_iv_hp not between 0 and 31
    or target_iv_attack not between 0 and 31
    or target_iv_defense not between 0 and 31
    or target_iv_special_attack not between 0 and 31
    or target_iv_special_defense not between 0 and 31
    or target_iv_speed not between 0 and 31
  then
    raise exception using errcode = '22023', message = 'invalid_capture';
  end if;

  delete from public.character_capture_commands
  where command_id in (
    select command_id
    from public.character_capture_commands
    where expires_at < now()
    order by expires_at
    limit 100
  );

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(command_id::text, 0));

  select * into existing_command
  from public.character_capture_commands
  where character_capture_commands.command_id = complete_character_capture.command_id;

  if found then
    return query select existing_command.gold, existing_command.creature_id, existing_command.party_slot;
    return;
  end if;

  update public.characters as characters
  set gold = characters.gold - items.buy_price
  from public.items as items
  where characters.id = target_character_id
    and items.id = target_item_id
    and items.category = 'poke_ball'
    and items.buy_price > 0
    and characters.gold >= items.buy_price
  returning characters.gold into resulting_gold;

  if resulting_gold is null then
    insert into public.character_capture_commands (command_id, character_id)
    values (command_id, target_character_id);
    return;
  end if;

  if capture_succeeded then
    select candidate.slot into available_party_slot
    from pg_catalog.generate_series(1, 6) as candidate(slot)
    where not exists (
      select 1 from public.creatures
      where creatures.character_id = target_character_id
        and creatures.party_slot = candidate.slot
    )
    order by candidate.slot
    limit 1;

    insert into public.creatures (
      character_id, species_id, party_slot, gender, experience,
      iv_hp, iv_attack, iv_defense, iv_special_attack, iv_special_defense, iv_speed
    ) values (
      target_character_id, target_species_id, available_party_slot, target_gender,
      (50::bigint * target_level * target_level * target_level - 150::bigint * target_level * target_level + 400::bigint * target_level) / 3,
      target_iv_hp, target_iv_attack, target_iv_defense,
      target_iv_special_attack, target_iv_special_defense, target_iv_speed
    ) returning id into created_creature_id;
  end if;

  insert into public.character_capture_commands (
    command_id, character_id, gold, creature_id, party_slot
  ) values (
    command_id, target_character_id, resulting_gold, created_creature_id, available_party_slot
  );

  return query select resulting_gold, created_creature_id, available_party_slot;
end;
$$;

revoke all on function public.complete_character_capture(uuid, uuid, smallint, smallint, smallint, text, text, smallint, smallint, smallint, smallint, smallint, smallint, boolean) from public, anon, authenticated;
grant execute on function public.complete_character_capture(uuid, uuid, smallint, smallint, smallint, text, text, smallint, smallint, smallint, smallint, smallint, smallint, boolean) to service_role;
