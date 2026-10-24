-- Creatures -- the hunt combat content.
--
-- The simulation needs more than the catalog had: an ability has to know how
-- it reaches a target and how an area propagates, an item has to know how much
-- it heals and how long it waits, and a wild creature has to know how often it
-- tries each of its abilities. The columns are additive, so the RLS policies
-- and the grants of the existing tables stay untouched.
--
-- The snapshot of the simulation lives in `hunt_sessions.simulation_state`. It
-- is a checkpoint like the rest of the row: the runner writes it every couple
-- of seconds, and the resume reads it back before the next advance.

alter table public.hunt_sessions
  add column simulation_state jsonb;

alter table public.abilities
  add column target_type text not null default 'target',
  add column range int not null default 1,
  add column area_shape text,
  add column area_length int,
  add column area_radius int,
  add column area_step_ms int not null default 150,
  add column travel_ms int not null default 0;

alter table public.abilities
  add constraint abilities_target_type_check check (target_type in ('target', 'area')),
  add constraint abilities_range_check check (range >= 0),
  add constraint abilities_area_shape_check check (area_shape in ('line', 'circle')),
  add constraint abilities_area_length_check check (area_length is null or area_length >= 1),
  add constraint abilities_area_radius_check check (area_radius is null or area_radius >= 1),
  add constraint abilities_area_step_ms_check check (area_step_ms >= 50),
  add constraint abilities_travel_ms_check check (travel_ms >= 0);

alter table public.items
  add column heal_percent int,
  add column cooldown_ms int not null default 2000;

alter table public.items
  add constraint items_heal_percent_check check (heal_percent is null or heal_percent between 1 and 100),
  add constraint items_cooldown_ms_check check (cooldown_ms >= 0);

alter table public.species_abilities
  add column wild_chance int not null default 0,
  add column wild_interval_ms int not null default 2000;

alter table public.species_abilities
  add constraint species_abilities_wild_chance_check check (wild_chance between 0 and 100),
  add constraint species_abilities_wild_interval_ms_check check (wild_interval_ms >= 1000);
