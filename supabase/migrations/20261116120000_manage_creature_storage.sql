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
declare created_creature_id uuid;
declare existing_command public.character_capture_commands%rowtype;
declare resulting_gold bigint;
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

  delete from public.character_capture_commands as commands
  where commands.command_id in (
    select expired.command_id
    from public.character_capture_commands as expired
    where expired.expires_at < now()
    order by expired.expires_at
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
    insert into public.creatures (
      character_id, species_id, party_slot, gender, experience,
      iv_hp, iv_attack, iv_defense, iv_special_attack, iv_special_defense, iv_speed
    ) values (
      target_character_id, target_species_id, null, target_gender,
      (50::bigint * target_level * target_level * target_level - 150::bigint * target_level * target_level + 400::bigint * target_level) / 3,
      target_iv_hp, target_iv_attack, target_iv_defense,
      target_iv_special_attack, target_iv_special_defense, target_iv_speed
    ) returning id into created_creature_id;
  end if;

  insert into public.character_capture_commands (
    command_id, character_id, gold, creature_id, party_slot
  ) values (
    command_id, target_character_id, resulting_gold, created_creature_id, null
  );

  return query select resulting_gold, created_creature_id, null::smallint;
end;
$$;

create or replace function public.release_creature(target_creature_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target_character_id uuid;
declare target_is_active boolean;
declare creature_count integer;
begin
  select creatures.character_id, creatures.id = characters.active_creature_id
  into target_character_id, target_is_active
  from public.creatures
  join public.characters on characters.id = creatures.character_id
  where creatures.id = target_creature_id
    and characters.user_id = auth.uid()
  for update of creatures, characters;

  if target_character_id is null then
    raise exception using errcode = '22023', message = 'creature_not_found';
  end if;
  if target_is_active then
    raise exception using errcode = '22023', message = 'active_creature_cannot_be_released';
  end if;

  select count(*) into creature_count
  from public.creatures
  where character_id = target_character_id;
  if creature_count <= 1 then
    raise exception using errcode = '22023', message = 'character_requires_creature';
  end if;

  delete from public.creatures where id = target_creature_id;
end;
$$;

create or replace function public.move_creature_to_storage(target_creature_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare owner_character_id uuid;
declare replacement_creature_id uuid;
begin
  select creatures.character_id into owner_character_id
  from public.creatures
  join public.characters on characters.id = creatures.character_id
  where creatures.id = target_creature_id
    and characters.user_id = auth.uid()
  for update of creatures, characters;

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

  update public.creatures set party_slot = null where id = target_creature_id;
  update public.characters
  set active_creature_id = replacement_creature_id
  where id = owner_character_id and active_creature_id = target_creature_id;
end;
$$;

create or replace function public.reorder_party_creature(
  target_creature_id uuid,
  target_party_slot smallint
)
returns void language plpgsql security definer set search_path = '' as $$
declare target_character_id uuid;
declare current_party_slot smallint;
declare destination_occupied boolean;
begin
  if target_party_slot not between 1 and 6 then
    raise exception using errcode = '22023', message = 'invalid_party_slot';
  end if;

  select creatures.character_id, creatures.party_slot
  into target_character_id, current_party_slot
  from public.creatures
  join public.characters on characters.id = creatures.character_id
  where creatures.id = target_creature_id
    and characters.user_id = auth.uid()
  for update of creatures, characters;

  if target_character_id is null or current_party_slot is null then
    raise exception using errcode = '22023', message = 'party_creature_not_found';
  end if;
  if current_party_slot = target_party_slot then
    return;
  end if;

  select exists(
    select 1 from public.creatures
    where character_id = target_character_id and party_slot = target_party_slot
  ) into destination_occupied;

  if destination_occupied then
    update public.creatures
    set party_slot = null
    where id = target_creature_id;

    update public.creatures
    set party_slot = current_party_slot
    where character_id = target_character_id
      and party_slot = target_party_slot;

    update public.creatures
    set party_slot = target_party_slot
    where id = target_creature_id;
    return;
  end if;

  update public.creatures
  set party_slot = target_party_slot
  where id = target_creature_id;
end;
$$;

revoke all on function public.release_creature(uuid) from public, anon;
grant execute on function public.release_creature(uuid) to authenticated;
revoke all on function public.move_creature_to_storage(uuid) from public, anon;
grant execute on function public.move_creature_to_storage(uuid) to authenticated;
revoke all on function public.reorder_party_creature(uuid, smallint) from public, anon;
grant execute on function public.reorder_party_creature(uuid, smallint) to authenticated;
