alter table public.characters
  add column active_creature_id uuid references public.creatures (id) on delete set null;

update public.characters as characters
set active_creature_id = (
  select creatures.id
  from public.creatures
  where creatures.character_id = characters.id
    and creatures.party_slot is not null
  order by creatures.party_slot
  limit 1
)
where characters.active_creature_id is null
  and exists (
    select 1
    from public.creatures
    where creatures.character_id = characters.id
      and creatures.party_slot is not null
  );

create or replace function public.give_starter_creature(target_character_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare created_creature_id uuid;
begin
  insert into public.creatures (
    character_id, species_id, party_slot, gender, experience,
    iv_hp, iv_attack, iv_defense, iv_special_attack, iv_special_defense, iv_speed
  ) values (
    target_character_id, (array[1, 4, 7])[1 + floor(random() * 3)::integer], 1,
    case when random() < .5 then 'male' else 'female' end, 1500,
    15, 15, 15, 15, 15, 15
  ) returning id into created_creature_id;

  update public.characters
  set active_creature_id = created_creature_id
  where id = target_character_id;

  return created_creature_id;
end; $$;

create or replace function public.select_active_creature(target_character_id uuid, target_creature_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.characters as characters
  set active_creature_id = target_creature_id
  where characters.id = target_character_id
    and exists (
      select 1 from public.creatures
      where creatures.id = target_creature_id
        and creatures.character_id = characters.id
        and creatures.party_slot is not null
    );

  if not found then
    raise exception using errcode = '22023', message = 'invalid_active_creature';
  end if;
end; $$;

revoke all on function public.select_active_creature(uuid, uuid) from public, anon, authenticated;
grant execute on function public.select_active_creature(uuid, uuid) to service_role;

create or replace function public.move_creature_to_storage(target_creature_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare owner_character_id uuid;
declare replacement_creature_id uuid;
begin
  select character_id into owner_character_id
  from public.creatures
  where id = target_creature_id
  for update;

  if owner_character_id is null then
    raise exception using errcode = '22023', message = 'creature_not_found';
  end if;

  select id into replacement_creature_id
  from public.creatures
  where character_id = owner_character_id
    and party_slot is not null
    and id <> target_creature_id
  order by party_slot
  limit 1;

  if replacement_creature_id is null then
    raise exception using errcode = '22023', message = 'party_requires_active_creature';
  end if;

  update public.creatures
  set party_slot = null
  where id = target_creature_id;

  update public.characters
  set active_creature_id = replacement_creature_id
  where id = owner_character_id
    and active_creature_id = target_creature_id;
end; $$;

revoke all on function public.move_creature_to_storage(uuid) from public, anon;
grant execute on function public.move_creature_to_storage(uuid) to authenticated;

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
  delete from public.character_hunt_completion_commands as expired_command
  where expired_command.checkpoint_id in (
    select candidate.checkpoint_id from public.character_hunt_completion_commands as candidate
    where candidate.expires_at < now() order by candidate.expires_at limit 100
  );
  select * into completion from public.character_hunt_completion_commands as command
  where command.checkpoint_id = checkpoint_character_hunt.checkpoint_id;
  if found then
    if not finish_hunt or completion.hunt_id <> expected_hunt_id or completion.expected_revision <> expected_revision then
      raise exception using errcode = '22023', message = 'checkpoint_identity_mismatch';
    end if;
    return query select true, completion.resulting_revision, true;
    return;
  end if;
  select * into locked_hunt from public.character_hunts
  where character_hunts.hunt_id = expected_hunt_id for update;
  if not found then return query select false, null::bigint, false; return; end if;
  if locked_hunt.last_checkpoint_id = checkpoint_id then return query select true, locked_hunt.revision, false; return; end if;
  if locked_hunt.revision <> expected_revision then return query select false, null::bigint, false; return; end if;
  for experience_delta in select value from jsonb_array_elements(experience_deltas) order by value ->> 'creatureId' loop
    if jsonb_typeof(experience_delta) <> 'object'
      or (experience_delta ->> 'creatureId') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89ab][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      or (experience_delta ->> 'amount') !~ '^[0-9]+$' then
      raise exception using errcode = '22023', message = 'invalid_experience_delta';
    end if;
    update public.creatures set experience = creatures.experience + (experience_delta ->> 'amount')::bigint
    where creatures.id = (experience_delta ->> 'creatureId')::uuid and creatures.character_id = locked_hunt.character_id;
  end loop;
  update public.characters set active_creature_id = next_active_creature_id
  where id = locked_hunt.character_id and exists (
    select 1 from public.creatures where creatures.id = next_active_creature_id
      and creatures.character_id = locked_hunt.character_id and creatures.party_slot is not null
  );
  if finish_hunt then
    delete from public.character_hunts where character_hunts.hunt_id = expected_hunt_id;
    insert into public.character_hunt_completion_commands (checkpoint_id, hunt_id, expected_revision, resulting_revision)
    values (checkpoint_character_hunt.checkpoint_id, expected_hunt_id, expected_revision, expected_revision + 1);
    return query select true, expected_revision + 1, true;
    return;
  end if;
  update public.character_hunts set active_creature_id = next_active_creature_id,
    active_creature_health = next_active_creature_health, player_position = next_player_position,
    enemies = next_enemies, wave = next_wave, next_event_at = next_event_time, combat_events = next_combat_events,
    ability_cooldowns = next_ability_cooldowns, runtime_snapshot = next_runtime_snapshot, revision = revision + 1,
    updated_at = now(), last_checkpoint_id = checkpoint_character_hunt.checkpoint_id
  where character_hunts.hunt_id = expected_hunt_id returning revision into updated_revision;
  return query select true, updated_revision, false;
end;
$$;
