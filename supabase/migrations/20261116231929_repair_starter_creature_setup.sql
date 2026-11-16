create or replace function public.give_starter_creature(target_character_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare created_creature_id uuid;
begin
  insert into public.creatures (
    character_id, species_id, party_slot, gender, experience, nature_slug,
    iv_hp, iv_attack, iv_defense, iv_special_attack, iv_special_defense, iv_speed
  ) values (
    target_character_id, (array[1, 4, 7])[1 + floor(random() * 3)::integer], 1,
    case when random() < .5 then 'male' else 'female' end, 1500,
    (array['hardy', 'lonely', 'brave', 'adamant', 'naughty', 'bold', 'docile', 'relaxed', 'impish', 'lax', 'timid', 'hasty', 'serious', 'jolly', 'naive', 'modest', 'mild', 'quiet', 'bashful', 'rash', 'calm', 'gentle', 'sassy', 'careful', 'quirky'])[1 + floor(random() * 25)::integer],
    15, 15, 15, 15, 15, 15
  ) returning id into created_creature_id;

  update public.characters
  set active_creature_id = created_creature_id
  where id = target_character_id;

  return created_creature_id;
end;
$$;

update public.characters as characters
set active_creature_id = (
  select creatures.id
  from public.creatures
  where creatures.character_id = characters.id
    and creatures.party_slot is not null
  order by creatures.party_slot, creatures.id
  limit 1
)
where characters.active_creature_id is null
  and exists (
    select 1
    from public.creatures
    where creatures.character_id = characters.id
      and creatures.party_slot is not null
  );

update public.creatures as creatures
set experience = 1500
where creatures.experience = 0
  and creatures.party_slot = 1
  and creatures.species_id in (1, 4, 7)
  and 1 = (
    select count(*)
    from public.creatures as owned_creatures
    where owned_creatures.character_id = creatures.character_id
  );
