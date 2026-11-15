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
