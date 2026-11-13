alter table public.character_hunts
  add column wave_size smallint not null default 1 check (wave_size between 1 and 5);
