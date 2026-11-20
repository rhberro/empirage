-- Drop obsolete position_x and position_y columns from hunting_locations
-- Character and monster spawns are now fully determined by map_data specialTiles (trainer_spawn, creature_spawn, enemy_spawn, blocked).

alter table public.hunting_locations
  drop column if exists position_x,
  drop column if exists position_y;
