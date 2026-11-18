create or replace function public.synchronize_creature_level_moves()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  with inserted_moves as (
    insert into public.creature_learned_moves (creature_id, move_id, learned_at_level)
    select new.id, learnset.move_id, coalesce(learnset.required_level, new.level)
    from public.species_move_learnsets as learnset
    where learnset.species_id = new.species_id
      and (
        (learnset.learn_method = 'level' and learnset.required_level <= new.level)
        or learnset.learn_method = 'evolution'
      )
    on conflict (creature_id, move_id) do nothing
    returning move_id
  ), new_moves as (
    select move_id, row_number() over (order by move_id) as position
    from inserted_moves
  ), empty_slots as (
    select candidate.slot, row_number() over (order by candidate.slot) as position
    from generate_series(1, 4) as candidate(slot)
    where not exists (
      select 1
      from public.creature_equipped_moves as equipped
      where equipped.creature_id = new.id and equipped.slot = candidate.slot
    )
  )
  insert into public.creature_equipped_moves (creature_id, move_id, slot)
  select new.id, new_moves.move_id, empty_slots.slot
  from new_moves join empty_slots using (position);

  return new;
end;
$$;

update public.creatures
set experience = experience;
