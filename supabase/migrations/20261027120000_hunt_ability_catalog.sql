-- Creatures -- the 2.2 ability catalog.
--
-- The catalog of 2.2 has three kinds of ability: one that reaches a target, one
-- that reaches an area around a target, and one that is centred on the caster
-- and needs no target at all. A species declares up to six abilities, while the
-- player keeps the four slots of `creature_ability_slots`: the two sets of slots
-- are independent. `set_creature_ability_slots` already checks the ability
-- against the species instead of against the slot the species declares, so an
-- ability in slot 4 or 5 of the species can be equipped in any player slot.
--
-- The change is additive: no row is touched here, the catalog rows are owned by
-- the seed.

alter table public.abilities
  drop constraint abilities_target_type_check,
  add constraint abilities_target_type_check
    check (target_type in ('target', 'area', 'area_self'));

alter table public.species_abilities
  drop constraint species_abilities_slot_check,
  add constraint species_abilities_slot_check check (slot between 0 and 5);
