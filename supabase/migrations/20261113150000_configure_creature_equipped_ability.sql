create or replace function public.configure_creature_equipped_ability(
  target_creature_id uuid,
  target_slot smallint,
  target_ability_id smallint default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_slot not between 1 and 4 then
    raise exception 'invalid_ability_slot';
  end if;

  if target_ability_id is null then
    delete from public.creature_equipped_abilities
    where creature_id = target_creature_id
      and slot = target_slot;
    return;
  end if;

  delete from public.creature_equipped_abilities
  where creature_id = target_creature_id
    and ability_id = target_ability_id
    and slot <> target_slot;

  insert into public.creature_equipped_abilities (creature_id, ability_id, slot)
  values (target_creature_id, target_ability_id, target_slot)
  on conflict (creature_id, slot) do update
  set ability_id = excluded.ability_id;
end;
$$;

revoke execute on function public.configure_creature_equipped_ability(uuid, smallint, smallint)
from public, anon, authenticated;

grant execute on function public.configure_creature_equipped_ability(uuid, smallint, smallint)
to service_role;
