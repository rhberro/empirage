create or replace function public.synchronize_creature_level_moves()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  with inserted_moves as (
    insert into public.creature_learned_moves (creature_id, move_id, learned_at_level)
    select new.id, learnset.move_id, learnset.required_level
    from public.species_move_learnsets as learnset
    where learnset.species_id = new.species_id
      and learnset.learn_method = 'level'
      and learnset.required_level <= new.level
    on conflict (creature_id, move_id) do nothing
    returning move_id
  ), new_moves as (
    select move_id, row_number() over (order by move_id) as position
    from inserted_moves
  ), empty_slots as (
    select candidate.slot, row_number() over (order by candidate.slot) as position
    from generate_series(1, 4) as candidate(slot)
    where not exists (
      select 1 from public.creature_equipped_moves as equipped
      where equipped.creature_id = new.id and equipped.slot = candidate.slot
    )
  )
  insert into public.creature_equipped_moves (creature_id, move_id, slot)
  select new.id, new_moves.move_id, empty_slots.slot
  from new_moves join empty_slots using (position);

  return new;
end;
$$;

drop trigger if exists synchronize_creature_level_moves on public.creatures;
create trigger synchronize_creature_level_moves
after insert or update of experience, species_id on public.creatures
for each row execute function public.synchronize_creature_level_moves();

update public.creatures set experience = experience;

create or replace function public.configure_creature_equipped_move(target_creature_id uuid, target_slot smallint, target_move_id smallint default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_slot not between 1 and 4 then raise exception using message = 'invalid_move_slot'; end if;
  insert into public.creature_learned_moves (creature_id, move_id, learned_at_level)
  select creatures.id, learnset.move_id, learnset.required_level
  from public.creatures
  join public.species_move_learnsets as learnset on learnset.species_id = creatures.species_id
  where creatures.id = target_creature_id
    and learnset.learn_method = 'level'
    and learnset.required_level <= creatures.level
    and (target_move_id is null or learnset.move_id = target_move_id)
  on conflict (creature_id, move_id) do nothing;
  if target_move_id is not null and not exists (
    select 1 from public.creature_learned_moves
    where creature_id = target_creature_id and move_id = target_move_id
  ) then
    raise exception using message = 'move_not_learned';
  end if;
  delete from public.creature_equipped_moves
  where creature_id = target_creature_id and (slot = target_slot or move_id = target_move_id);
  if target_move_id is not null then
    insert into public.creature_equipped_moves (creature_id, move_id, slot)
    values (target_creature_id, target_move_id, target_slot);
  end if;
end;
$$;
