alter table public.hunting_locations
  add column wave_delay_seconds smallint not null default 3
    check (wave_delay_seconds >= 0);

alter table public.character_hunts
  add column wave_delay_seconds smallint not null default 3
    check (wave_delay_seconds >= 0);

grant update (position_x, position_y) on table public.characters to service_role;
