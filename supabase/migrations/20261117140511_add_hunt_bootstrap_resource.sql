create function public.load_hunt_bootstrap(target_character_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'active_creature_id', characters.active_creature_id,
    'avatar_url', characters.avatar_url,
    'capture_configuration', (
      select jsonb_build_object(
        'item_id', capture_configuration.item_id,
        'rarities', capture_configuration.rarities
      )
      from public.character_capture_configuration as capture_configuration
      where capture_configuration.character_id = characters.id
    ),
    'creatures', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'ev_attack', creatures.ev_attack,
          'ev_defense', creatures.ev_defense,
          'ev_hp', creatures.ev_hp,
          'ev_special_attack', creatures.ev_special_attack,
          'ev_special_defense', creatures.ev_special_defense,
          'ev_speed', creatures.ev_speed,
          'experience', creatures.experience,
          'id', creatures.id,
          'iv_attack', creatures.iv_attack,
          'iv_defense', creatures.iv_defense,
          'iv_hp', creatures.iv_hp,
          'iv_special_attack', creatures.iv_special_attack,
          'iv_special_defense', creatures.iv_special_defense,
          'iv_speed', creatures.iv_speed,
          'level', creatures.level,
          'nature_slug', creatures.nature_slug,
          'party_slot', creatures.party_slot,
          'species_id', creatures.species_id
        ) order by creatures.party_slot
      )
      from public.creatures
      where creatures.character_id = characters.id
        and creatures.party_slot is not null
    ), '[]'::jsonb),
    'equipped_moves', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'creature_id', equipped_moves.creature_id,
          'move_id', equipped_moves.move_id,
          'slot', equipped_moves.slot
        ) order by creatures.party_slot, equipped_moves.slot
      )
      from public.creature_equipped_moves as equipped_moves
      join public.creatures on creatures.id = equipped_moves.creature_id
      where creatures.character_id = characters.id
        and creatures.party_slot is not null
    ), '[]'::jsonb),
    'gold', characters.gold,
    'healing_configuration', (
      select jsonb_build_object(
        'item_id', healing_configuration.item_id,
        'threshold_percentage', healing_configuration.threshold_percentage
      )
      from public.character_battle_item_configuration as healing_configuration
      where healing_configuration.character_id = characters.id
    ),
    'level', characters.level,
    'name', characters.name
  )
  from public.characters
  where characters.id = target_character_id;
$$;

revoke all on function public.load_hunt_bootstrap(uuid) from public, anon, authenticated;
grant execute on function public.load_hunt_bootstrap(uuid) to service_role;
