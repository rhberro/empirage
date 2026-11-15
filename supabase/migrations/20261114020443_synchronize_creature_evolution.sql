create or replace function public.synchronize_creature_evolution()
returns trigger
language plpgsql
set search_path = ''
as $$
declare next_species_id smallint;
begin
  select evolutions.to_species_id
  into next_species_id
  from public.evolutions
  where evolutions.from_species_id = new.species_id
    and evolutions.trigger = 'level'
    and evolutions.required_level <= new.level
  order by evolutions.required_level, evolutions.to_species_id
  limit 1;

  if next_species_id is not null then
    update public.creatures
    set species_id = next_species_id
    where creatures.id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists synchronize_creature_evolution on public.creatures;
create trigger synchronize_creature_evolution
after insert or update of experience, species_id on public.creatures
for each row execute function public.synchronize_creature_evolution();

update public.creatures set experience = experience;
