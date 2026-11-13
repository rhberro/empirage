create table public.creature_species_moves (
  species_id smallint not null references public.creature_species (id) on delete cascade,
  ability_id smallint not null references public.abilities (id),
  required_level smallint not null check (required_level > 0),
  primary key (species_id, ability_id)
);

create index creature_species_moves_ability_id_idx
on public.creature_species_moves (ability_id);

alter table public.creature_species_moves enable row level security;
revoke all on table public.creature_species_moves from anon, authenticated;
grant select on table public.creature_species_moves to authenticated;
grant select, insert, update, delete on table public.creature_species_moves to service_role;

create policy "Authenticated users can view creature species moves"
on public.creature_species_moves for select to authenticated using (true);

alter table public.abilities
  alter column cooldown_seconds set default 2;

update public.abilities
set cooldown_seconds = 2
where kind = 'move' and cooldown_seconds = 0;

with species_move_seed (species_id, ability_id, required_level) as (
  values
  (1, 33, 1),
  (1, 71, 3),
  (1, 22, 7),
  (1, 75, 13),
  (1, 76, 27),
  (4, 10, 1),
  (4, 52, 9),
  (4, 83, 15),
  (4, 53, 24),
  (4, 126, 38),
  (7, 33, 1),
  (7, 145, 8),
  (7, 55, 15),
  (7, 44, 22),
  (7, 56, 42),
  (16, 33, 1),
  (16, 16, 5),
  (16, 98, 12),
  (16, 17, 19),
  (16, 143, 36),
  (19, 33, 1),
  (19, 98, 7),
  (19, 44, 14),
  (19, 29, 23),
  (25, 84, 1),
  (25, 98, 11),
  (25, 85, 26),
  (25, 87, 41),
  (41, 141, 1),
  (41, 44, 15),
  (41, 109, 21),
  (41, 17, 27),
  (43, 71, 1),
  (43, 51, 15),
  (43, 75, 24),
  (43, 80, 39),
  (54, 10, 1),
  (54, 55, 9),
  (54, 93, 16),
  (54, 60, 31),
  (60, 145, 1),
  (60, 55, 13),
  (60, 61, 19),
  (60, 56, 35),
  (74, 33, 1),
  (74, 88, 11),
  (74, 91, 16),
  (74, 89, 31)
)
insert into public.creature_species_moves (species_id, ability_id, required_level)
select seed.species_id, seed.ability_id, seed.required_level
from species_move_seed as seed
join public.creature_species as species on species.id = seed.species_id
join public.abilities as abilities on abilities.id = seed.ability_id
on conflict (species_id, ability_id) do update set
  required_level = excluded.required_level;

insert into public.creature_equipped_abilities (creature_id, ability_id, slot)
select creatures.id, selected.ability_id, selected.slot
from public.creatures
cross join lateral (
  select available.ability_id,
    row_number() over (order by available.random_order)::smallint as slot
  from (
    select moves.ability_id, random() as random_order
    from public.creature_species_moves as moves
    where moves.species_id = creatures.species_id
      and moves.required_level <= creatures.level
    order by random()
    limit 4
  ) as available
) as selected
where not exists (
  select 1
  from public.creature_equipped_abilities as equipped
  where equipped.creature_id = creatures.id
)
on conflict do nothing;

create or replace function public.fill_initial_creature_abilities()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.creature_equipped_abilities (creature_id, ability_id, slot)
  select new.id, selected.ability_id, selected.slot
  from (
    select available.ability_id,
      row_number() over (order by available.random_order)::smallint as slot
    from (
      select moves.ability_id, random() as random_order
      from public.creature_species_moves as moves
      where moves.species_id = new.species_id
        and moves.required_level <= new.level
      order by random()
      limit 4
    ) as available
  ) as selected
  on conflict do nothing;
  return new;
end;
$$;

revoke execute on function public.fill_initial_creature_abilities() from public, anon, authenticated;
